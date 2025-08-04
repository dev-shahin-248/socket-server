FROM node:18

# Set working directory inside container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Install nodemon globally for dev mode (optional)
RUN npm install -g nodemon

# Expose port 3000
EXPOSE 3000

# Start the server with nodemon for live reload
CMD ["npm", "run", "dev"]
