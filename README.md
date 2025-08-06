# Socket.IO Server

A self-hosted Socket.IO server with Docker support for development and production environments.

## Features

- 🚀 **Auto-sync**: Package.json changes are automatically synchronized with the container
- 🔄 **Live Reload**: Nodemon automatically restarts the server when files change
- 🐳 **Docker Support**: Both development and production Docker configurations
- 🛡️ **Security**: Runs as non-root user in production
- 📊 **Health Checks**: Built-in health monitoring
- 🔧 **Development Tools**: Optimized for development workflow

## Quick Start

### Development Mode

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd socket-server
   ```

2. **Start development server:**
   ```bash
   docker-compose up --build
   ```

   This will:
   - Build the development Docker image
   - Install dependencies automatically
   - Start the server with hot reload
   - Sync any package.json changes automatically

3. **Add new packages:**
   ```bash
   # Just modify package.json and the container will auto-install
   npm install --save express-rate-limit
   
   # Or run npm commands directly in the container:
   docker-compose exec socket-server npm install --save express-rate-limit
   ```

### Production Mode

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

## Project Structure

```
socket-server/
├── src/                    # Source files (optional organization)
├── .dockerignore          # Docker build exclusions
├── .gitignore            # Git exclusions
├── Dockerfile            # Development Dockerfile
├── Dockerfile.prod       # Production Dockerfile
├── docker-compose.yml    # Development compose
├── docker-compose.prod.yml # Production compose
├── package.json          # Dependencies
└── index.js             # Main server file
```

## Docker Commands

### Development
```bash
# Start development environment
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f socket-server

# Stop containers
docker-compose down

# Rebuild after Dockerfile changes
docker-compose up --build

# Install packages
docker-compose exec socket-server npm install <package-name>

# Access container shell
docker-compose exec socket-server sh
```

### Production
```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop production
docker-compose -f docker-compose.prod.yml down
```

## Environment Variables

Create a `.env` file for environment-specific configuration:

```env
NODE_ENV=development
PORT=3000
DEBUG=socket.io:*
CHOKIDAR_USEPOLLING=true
```

## Package Management

The setup automatically handles package.json synchronization:

1. **Automatic Installation**: When you modify `package.json`, the container automatically runs `npm install`
2. **Volume Persistence**: `node_modules` are stored in a named Docker volume for performance
3. **Clean Installs**: Production builds use `npm ci` for consistent, faster installs

## API Endpoints

The Socket.IO server handles the following events:

- `join-room`: Join a chat room
- `send-message`: Send a message to a room
- `disconnect`: Handle client disconnection

## Development Tips

1. **File Watching**: Files are automatically watched and the server restarts on changes
2. **Debug Mode**: Socket.IO debug mode is enabled by default in development
3. **Performance**: Use `cached` volume mounting for better performance on macOS
4. **Port Access**: Server is accessible at `http://localhost:3000`

## Health Checks

Both development and production containers include health checks:
- **Endpoint**: `http://localhost:3000`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   docker-compose down
   # Or change the port in docker-compose.yml
   ```

2. **Package installation issues:**
   ```bash
   # Clear volumes and rebuild
   docker-compose down -v
   docker-compose up --build
   ```

3. **File watching not working:**
   - Ensure `CHOKIDAR_USEPOLLING=true` is set
   - Check that files are properly mounted

4. **Permission issues:**
   - The container runs as a non-root user for security
   - File ownership is automatically handled

### Performance Optimization

1. **Use .dockerignore**: Exclude unnecessary files from build context
2. **Named volumes**: Node_modules are stored in named volumes for better performance
3. **Multi-stage builds**: Production builds use multi-stage builds for smaller images
4. **Layer caching**: Dockerfile layers are optimized for Docker cache efficiency

## Contributing

1. Make your changes
2. Test in development mode: `docker-compose up`
3. Test in production mode: `docker-compose -f docker-compose.prod.yml up`
4. Ensure all health checks pass
5. Submit your pull request

## License

MIT License - see LICENSE file for details
