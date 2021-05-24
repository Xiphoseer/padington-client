FROM node:16-alpine3.13 as builder

# Create app directory
WORKDIR /usr/src/padington-client

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# Build the app for production
RUN npm ci

COPY . .

RUN npm run build

FROM alpine:3.13

RUN apk update \
    && apk add lighttpd \
    && rm -rf /var/cache/apk/*

COPY --from=builder /usr/src/padington-client/public /var/www/localhost/htdocs

EXPOSE 80/tcp

ENTRYPOINT ["lighttpd","-D","-f","/etc/lighttpd/lighttpd.conf"]
