FROM node:6.9.0

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install
RUN npm i -g pm2

# Bundle app source
COPY . /usr/src/app

EXPOSE 3978
CMD [ "npm", "run", "pm2" ]