# 化学私教课后反馈生成系统

这是一个专为化学私教设计的课后反馈生成工具，利用 AI 技术从课件中提取知识点并生成极具亲和力、专业且细致的反馈报告。

## 核心功能

1.  **课件深度分析**：支持 PDF、Word、图片及纯文本课件上传，自动提取知识点并生成精炼的课堂内容汇总。
2.  **两阶段 AI 处理**：
    *   **阶段一**：分析课件，提取 8-12 个知识点及 2-3 条核心内容汇总。
    *   **阶段二**：针对选定知识点生成 4 维度评价、表现标签及作业建议。
3.  **多模型支持**：支持 Google Gemini、OpenAI、DeepSeek、通义千问 (Qwen)、零一万物 (Yi) 等多种 AI 服务商。
4.  **高度自定义**：可在设置中配置不同阶段使用的模型、API Key 及 Base URL。
5.  **风格学习**：AI 生成的反馈报告参考了真实的优秀范例，语气亲切、专业，包含具体的正确率评价和互动细节。

## 快速启动

### 1. 安装依赖

在项目根目录下运行：

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

启动后，访问 [http://localhost:3000](http://localhost:3000) 即可使用。

### 3. 配置 AI

1.  打开应用后，点击右上角的 **“设置”** 图标。
2.  选择您偏好的 **AI 服务商**（如 Google, DeepSeek 等）。
3.  输入对应的 **API Key**。
4.  （可选）根据需要修改各个阶段使用的 **模型名称**。
5.  点击 **“保存配置”**。

## 生产环境构建

```bash
npm run build
```

构建产物将存放在 `dist` 目录中。

## 技术栈

*   **前端框架**：React + TypeScript
*   **样式**：Tailwind CSS
*   **动画**：Framer Motion
*   **图标**：Lucide React
*   **AI 集成**：Google Generative AI SDK + OpenAI 兼容接口
*   **文件解析**：pdfjs-dist, mammoth

## 公网服务器部署指南

本项目是一个纯前端的单页面应用 (SPA)，构建后生成静态文件，可以部署在任何支持静态文件托管的 Web 服务器上（如 Nginx、Apache）或使用 Docker 部署。

### 方案一：使用 Nginx 部署（推荐）

**1. 准备工作**
确保您的公网服务器（如 Ubuntu/CentOS）已安装 Node.js (推荐 v18+) 和 Nginx。

**2. 获取代码并构建**
```bash
# 克隆或上传代码到服务器
cd /path/to/your/project

# 安装依赖
npm install

# 构建生产环境静态文件
npm run build
```
构建完成后，项目根目录下会生成一个 `dist` 文件夹，里面包含了所有需要部署的静态文件。

**3. 配置 Nginx**
编辑 Nginx 配置文件（通常位于 `/etc/nginx/conf.d/yourdomain.conf` 或 `/etc/nginx/sites-available/default`）：

```nginx
server {
    listen 80;
    server_name yourdomain.com; # 替换为您的域名或公网 IP

    # 指向刚才构建生成的 dist 目录的绝对路径
    root /path/to/your/project/dist; 
    index index.html;

    # SPA 路由回退配置，防止刷新 404
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 可选：开启 gzip 压缩提高加载速度
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

**4. 启动/重启 Nginx**
```bash
# 测试配置是否正确
sudo nginx -t

# 重启 Nginx 使配置生效
sudo systemctl restart nginx
```

### 方案二：使用 Docker 部署

如果您更喜欢使用 Docker，可以通过 Nginx 镜像快速部署。

**1. 创建 Dockerfile**
在项目根目录创建一个名为 `Dockerfile` 的文件：
```dockerfile
# 构建阶段
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 运行阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# 覆盖默认的 nginx 配置以支持 SPA 路由
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**2. 构建并运行容器**
```bash
# 构建 Docker 镜像
docker build -t feedback-assistant .

# 运行容器，将容器的 80 端口映射到宿主机的 80 端口
docker run -d -p 80:80 --name feedback-app feedback-assistant
```

部署完成后，您就可以通过服务器的公网 IP 或绑定的域名访问该系统了。由于 API Key 是在浏览器端（客户端）直接发起的请求，因此不需要在服务器端额外配置环境变量，用户在界面右上角的“设置”中配置即可。
