# Use Node.js 20 lightweight Debian slim image for 100% compatibility with npm packages
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy only package.json to avoid Windows package-lock mismatch on Alpine Linux
COPY package.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm install

# Copy source code files
COPY . .

# Run build process
RUN npm run build

# Expose server port
EXPOSE 3000

# Start server
CMD ["npm", "start"]