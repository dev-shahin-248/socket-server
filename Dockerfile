FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /usr/src/app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install all dependencies (including dev dependencies for development)
RUN npm ci --no-audit --no-optional && \
    npm cache clean --force

# Install nodemon globally for development
RUN npm install -g nodemon

# Change ownership of the app directory to nodejs user
RUN chown -R nodejs:nodejs /usr/src/app
USER nodejs

# Copy source code (this will be overridden by volume in docker-compose for dev)
COPY --chown=nodejs:nodejs . .

# Expose port 3000
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command for development (can be overridden)
CMD ["npm", "run", "dev"]
