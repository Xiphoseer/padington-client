FROM node:16-alpine3.13 as builder

# Create app directory
WORKDIR /usr/src/padington-client

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# Build the app for production
RUN npm ci

# Copy the full app source
COPY . .

# Run the standard production build
RUN npm run build

# Use an alpine image
FROM alpine:3.13

# Install lighttpd
RUN apk update \
    && apk add lighttpd \
    && rm -rf /var/cache/apk/*

# Copy the app from the builder
COPY --from=builder /usr/src/padington-client/public /var/www/localhost/htdocs

# Set the exposed port
EXPOSE 80/tcp

# Set the labels
LABEL org.opencontainers.image.licenses="MIT OR Apache-2.0"
LABEL org.opencontainers.image.source="https://github.com/Xiphoseer/padington-client"
LABEL org.opencontainers.image.title="Padington (Standalone Client)"
LABEL org.opencontainers.image.description="Collaborative Text-Editor – Standalone Client"

# Run the http deamon as the entry point
ENTRYPOINT ["lighttpd","-D","-f","/etc/lighttpd/lighttpd.conf"]
