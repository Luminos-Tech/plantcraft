FROM node:20-alpine

WORKDIR /app

# Install dependencies needed for some node packages
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./

# Note: We will handle npm install via docker-compose or manual command 
# to ensure node_modules are synced with the host if needed, 
# but for a container-only approach:
# RUN npm install

EXPOSE 6001

CMD ["npm", "run", "start"]
