# Multi-stage build for smaller final image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Production stage
FROM node:20-alpine

# Install FFmpeg and fonts (for drawtext)
RUN apk add --no-cache ffmpeg ttf-dejavu

WORKDIR /app

# Copy only production dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV FFMPEG_FONT=/usr/share/fonts/dejavu/DejaVuSans.ttf

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]