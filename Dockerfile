FROM node:18
WORKDIR /app
COPY REVORZ/REVORZ/package*.json ./
RUN npm install
COPY REVORZ/REVORZ/ .
EXPOSE 8888
CMD ["node", "server.js"]
