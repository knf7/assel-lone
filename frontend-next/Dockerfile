FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Build Next.js application
RUN npm run build

# Expose Next.js port
EXPOSE 3000

# Start production server
CMD ["npm", "start"]
