# 使用Node.js官方镜像作为基础镜像
FROM node:24-bookworm

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制项目文件
COPY . .

# 构建前端
RUN npm run build

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 4173

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=4173

# 启动应用
CMD ["npm", "start"]