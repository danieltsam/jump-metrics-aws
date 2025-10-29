// AWS Cognito Authentication Service
import { 
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  ListUsersCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { environment } from '../config/environment.js';
import { getParameterValue } from '../config/parameterStoreConfig.js';

/**
 * Cognito Authentication Service
 * Handles user authentication, registration, and management
 */
class CognitoService {
  constructor() {
    this.userPoolId = null;
    this.clientId = null;
    this.configured = false;
  }

  async initialize() {
    try {
      // Try to load from Parameter Store first
      this.userPoolId = await getParameterValue('/jump-metrics/cognito/user-pool-id');
      this.clientId = await getParameterValue('/jump-metrics/cognito/client-id');
      
      if (this.userPoolId && this.clientId) {
        console.log('📋 Cognito configuration loaded from Parameter Store');
      } else {
        // Fallback to environment variables
        this.userPoolId = environment.cognito.userPoolId;
        this.clientId = environment.cognito.clientId;
        console.log('📋 Cognito configuration loaded from environment variables');
      }
      
      // Check if Cognito is configured
      if (!this.userPoolId || !this.clientId) {
        console.log(`🔓 Cognito not configured (missing userPoolId or clientId) - auth will fall back to simple auth`);
        this.configured = false;
        return;
      }
    
      this.client = new CognitoIdentityProviderClient({
        region: environment.cognito.region,
      });
      
      // JWT verifier for token validation
      this.jwtVerifier = CognitoJwtVerifier.create({
        userPoolId: this.userPoolId,
        tokenUse: 'access',
        clientId: this.clientId,
      });
      
      this.configured = true;
      console.log(`🔐 Cognito service initialized for pool: ${this.userPoolId}`);
    } catch (error) {
      console.warn(`🔓 Cognito initialization failed: ${error.message} - auth will fall back to simple auth`);
      this.configured = false;
    }
  }

  /**
   * Authenticate user with username/password
   */
  async signIn(username, password) {
    if (!this.configured) {
      return {
        success: false,
        error: 'COGNITO_NOT_CONFIGURED',
        message: 'Cognito authentication not available'
      };
    }
    
    try {
      const command = new InitiateAuthCommand({
        ClientId: this.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      });

      const response = await this.client.send(command);
      
      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        return {
          success: false,
          challenge: 'NEW_PASSWORD_REQUIRED',
          session: response.Session,
          message: 'New password required for first login'
        };
      }

      const tokens = response.AuthenticationResult;
      const userInfo = await this.getUserInfo(tokens.AccessToken);
      
      return {
        success: true,
        tokens: {
          accessToken: tokens.AccessToken,
          refreshToken: tokens.RefreshToken,
          idToken: tokens.IdToken,
          expiresIn: tokens.ExpiresIn
        },
        user: userInfo
      };
    } catch (error) {
      console.error('Cognito sign in error:', error);
      return {
        success: false,
        error: error.name,
        message: this._getErrorMessage(error)
      };
    }
  }

  /**
   * Get user information from access token
   */
  async getUserInfo(accessToken) {
    if (!this.configured) {
      throw new Error('Cognito not configured');
    }
    
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.client.send(command);
      
      const attributes = {};
      response.UserAttributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });

      // Get user groups
      const groups = await this.getUserGroups(response.Username);
      
      return {
        username: response.Username,
        email: attributes.email,
        role: attributes['custom:role'] || 'user',
        emailVerified: attributes.email_verified === 'true',
        groups: groups,
        attributes
      };
    } catch (error) {
      console.error('Get user info error:', error);
      throw error;
    }
  }

  /**
   * Get user groups from Cognito
   */
  async getUserGroups(username) {
    if (!this.configured) {
      return [];
    }
    try {
      const { AdminListGroupsForUserCommand } = await import('@aws-sdk/client-cognito-identity-provider');
      const command = new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      });
      const response = await this.client.send(command);
      return response.Groups?.map(group => group.GroupName) || [];
    } catch (error) {
      console.warn('Failed to get user groups, defaulting to empty array:', error.message);
      return [];
    }
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(accessToken) {
    if (!this.configured) {
      return {
        valid: false,
        error: 'Cognito not configured'
      };
    }
    
    try {
      const payload = await this.jwtVerifier.verify(accessToken);
      return {
        valid: true,
        payload,
        username: payload.username,
        clientId: payload.client_id
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Create a new user (admin only)
   */
  async createUser(username, email, role = 'user', temporaryPassword = null) {
    try {
      const tempPassword = temporaryPassword || this._generateTempPassword();
      
      const createCommand = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:role', Value: role }
        ],
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS', // Don't send welcome email
      });

      await this.client.send(createCommand);

      // Set permanent password if provided
      if (temporaryPassword) {
        const setPasswordCommand = new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          Password: temporaryPassword,
          Permanent: true
        });
        
        await this.client.send(setPasswordCommand);
      }

      return {
        success: true,
        username,
        temporaryPassword: temporaryPassword
      };
    } catch (error) {
      console.error('Create user error:', error);
      return {
        success: false,
        error: error.name,
        message: this._getErrorMessage(error)
      };
    }
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(username, newRole) {
    try {
      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        UserAttributes: [
          { Name: 'custom:role', Value: newRole }
        ]
      });

      await this.client.send(command);
      
      return { success: true };
    } catch (error) {
      console.error('Update user role error:', error);
      return {
        success: false,
        error: error.name,
        message: this._getErrorMessage(error)
      };
    }
  }

  /**
   * List all users (admin only)
   */
  async listUsers(limit = 60) {
    try {
      const command = new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Limit: limit
      });

      const response = await this.client.send(command);
      
      const users = response.Users.map(user => {
        const attributes = {};
        user.Attributes?.forEach(attr => {
          attributes[attr.Name] = attr.Value;
        });

        return {
          username: user.Username,
          email: attributes.email,
          role: attributes['custom:role'] || 'user',
          status: user.UserStatus,
          enabled: user.Enabled,
          created: user.UserCreateDate,
          lastModified: user.UserLastModifiedDate
        };
      });

      return { success: true, users };
    } catch (error) {
      console.error('List users error:', error);
      return {
        success: false,
        error: error.name,
        message: this._getErrorMessage(error)
      };
    }
  }

  /**
   * Enable/disable user (admin only)
   */
  async setUserEnabled(username, enabled) {
    try {
      const command = enabled 
        ? new AdminEnableUserCommand({
            UserPoolId: this.userPoolId,
            Username: username
          })
        : new AdminDisableUserCommand({
            UserPoolId: this.userPoolId,
            Username: username
          });

      await this.client.send(command);
      
      return { success: true };
    } catch (error) {
      console.error('Set user enabled error:', error);
      return {
        success: false,
        error: error.name,
        message: this._getErrorMessage(error)
      };
    }
  }

  /**
   * Check if Cognito is available
   */
  async isAvailable() {
    if (!this.configured) {
      return false;
    }
    
    try {
      // Try a simple operation to test connectivity
      await this.client.send(new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Limit: 1
      }));
      
      return true;
    } catch (error) {
      console.warn('Cognito not available:', error.message);
      return false;
    }
  }

  /**
   * Generate temporary password
   */
  _generateTempPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password + '1!'; // Ensure it meets complexity requirements
  }

  /**
   * Convert AWS error to user-friendly message
   */
  _getErrorMessage(error) {
    switch (error.name) {
      case 'NotAuthorizedException':
        return 'Invalid username or password';
      case 'UserNotFoundException':
        return 'User not found';
      case 'UserNotConfirmedException':
        return 'User account not confirmed';
      case 'InvalidPasswordException':
        return 'Password does not meet requirements';
      case 'UsernameExistsException':
        return 'Username already exists';
      case 'InvalidParameterException':
        return 'Invalid parameters provided';
      case 'TooManyRequestsException':
        return 'Too many requests, please try again later';
      default:
        return error.message || 'Authentication error occurred';
    }
  }

  /**
   * User self sign-up (username, password, email)
   */
  async signUp(username, password, email) {
    if (!this.configured) {
      return { success: false, error: 'COGNITO_NOT_CONFIGURED', message: 'Cognito not configured' };
    }
    try {
      const { SignUpCommand } = await import('@aws-sdk/client-cognito-identity-provider');
      const command = new SignUpCommand({
        ClientId: this.clientId,
        Username: username,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
        ],
      });
      const response = await this.client.send(command);
      return { success: true, userConfirmed: !!response.UserConfirmed };
    } catch (error) {
      console.error('Cognito signUp error:', error);
      return { success: false, error: error.name, message: this._getErrorMessage(error) };
    }
  }

  /**
   * Confirm user sign-up with verification code
   */
  async confirmSignUp(username, code) {
    if (!this.configured) {
      return { success: false, error: 'COGNITO_NOT_CONFIGURED', message: 'Cognito not configured' };
    }
    try {
      const { ConfirmSignUpCommand } = await import('@aws-sdk/client-cognito-identity-provider');
      const command = new ConfirmSignUpCommand({
        ClientId: this.clientId,
        Username: username,
        ConfirmationCode: code,
      });
      await this.client.send(command);
      return { success: true };
    } catch (error) {
      console.error('Cognito confirmSignUp error:', error);
      return { success: false, error: error.name, message: this._getErrorMessage(error) };
    }
  }

  /**
   * Resend confirmation code
   */
  async resendConfirmationCode(username) {
    if (!this.configured) {
      return { success: false, error: 'COGNITO_NOT_CONFIGURED', message: 'Cognito not configured' };
    }
    try {
      const { ResendConfirmationCodeCommand } = await import('@aws-sdk/client-cognito-identity-provider');
      const command = new ResendConfirmationCodeCommand({
        ClientId: this.clientId,
        Username: username,
      });
      await this.client.send(command);
      return { success: true };
    } catch (error) {
      console.error('Cognito resendConfirmationCode error:', error);
      return { success: false, error: error.name, message: this._getErrorMessage(error) };
    }
  }
}

// Create singleton instance
export const cognitoService = new CognitoService();
