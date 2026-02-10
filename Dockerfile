FROM node:25-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
# 这里的启动命令根据项目而定，AI Studio 通常使用 vite
CMD ["npm", "run", "dev", "--", "--host"]
