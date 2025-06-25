# NodeSeek Monitor

A monitoring system for NodeSeek community RSS feed with Telegram bot notifications.

## Features

- **RSS Monitoring**: Automatically monitors NodeSeek community RSS feed
- **Keyword Matching**: Configurable keyword subscriptions with AND logic
- **Telegram Integration**: Bot commands and push notifications
- **Web Dashboard**: User-friendly interface for configuration and management
- **Cloudflare Workers**: Serverless deployment with D1 database
- **Scheduled Tasks**: Automatic RSS processing every 10 minutes

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Hono (Cloudflare Workers)
- **Database**: Cloudflare D1
- **Deployment**: Cloudflare Workers

### Prerequisites

1. Cloudflare account
2. Telegram Bot Token (from @BotFather)
3. Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nodeseek-monitor
```

2. Install dependencies:
```bash
npm install
```

3. Configure Cloudflare D1 database:
```bash
# Create D1 database
wrangler d1 create nodeseek-monitor

# Update wrangler.json with your database ID
# Replace "your-database-id" with the actual database ID

# Run migrations
wrangler d1 migrations apply nodeseek-monitor
```

4. Deploy to Cloudflare Workers:
```bash
npm run deploy
```

### Configuration

1. **Initial Setup**: Visit your deployed application URL and complete the initialization:
   - Set admin username and password
   - Enter your Telegram Chat ID

2. **Telegram Bot Setup**:
   - Get your bot token from @BotFather
   - Enter the bot token in the dashboard
   - Click "Set Webhook" to configure the bot

3. **Subscription Management**:
   - Add keyword subscriptions in the dashboard
   - Configure creator and category filters (optional)
   - Keywords use AND logic (all must match)

## Telegram Bot Commands

- `/start` - Show help and save user info
- `/stop` - Stop push notifications
- `/resume` - Resume push notifications
- `/list` - List all subscriptions
- `/add <keyword1> [keyword2] [keyword3]` - Add subscription
- `/delete <subscription_id>` - Delete subscription
- `/post` - Show recent 10 posts with push status

## Configuration Options

### Basic Settings
- **Bot Token**: Telegram bot token for notifications
- **Chat ID**: Your Telegram chat ID for receiving notifications
- **Only Title**: Match keywords only in post titles (not content)
- **Stop Push**: Temporarily disable all notifications

### Subscription Rules
- **Keywords**: Up to 3 keywords (all must match)
- **Creator Filter**: Only match posts from specific authors
- **Category Filter**: Only match posts from specific categories

## Database Schema

The system uses three main tables:

- `base_config`: System configuration and user settings
- `posts`: Cached RSS posts with push status
- `keywords_sub`: Keyword subscription rules

## Development

```bash
# Start development server
pnpm run dev

# Build for production
pnpm run build

# Deploy to Cloudflare Workers
pnpm run deploy

# Run database migrations
wrangler d1 migrations apply nodeseek-monitor
```

## Scheduled Tasks

The system automatically processes RSS feeds every 10 minutes using Cloudflare Cron Triggers. You can also manually trigger RSS processing from the dashboard.

## API Endpoints

- `GET /api/config` - Get system configuration
- `POST /api/config` - Update system configuration
- `POST /api/login` - User authentication
- `GET /api/subscriptions` - Get all subscriptions
- `POST /api/subscriptions` - Create new subscription
- `PUT /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `GET /api/posts` - Get recent posts
- `POST /api/telegram/webhook` - Telegram webhook endpoint
- `POST /api/process-rss` - Manual RSS processing

## License

MIT

## Database Initialization

System uses Cloudflare D1 database, supports two initialization methods:

### 1. Automatic Initialization (Recommended)
System automatically creates required tables on first access, no manual operation needed.

### 2. Manual Initialization
If manual initialization is needed, call initialization API:

```bash
POST /api/init
```

## Data Table Structure

System contains three main data tables:

1. **base_config** - Basic Configuration Table
   - Stores user name, password, Telegram Bot configuration, etc.

2. **posts** - Article Table
   - Stores monitored article information and push status

3. **keywords_sub** - Keyword Subscription Table
   - Stores keyword matching rules

## Deployment Instructions

1. Ensure Cloudflare D1 database is configured
2. Configure database binding in `wrangler.json`
3. After deployment, system automatically creates data tables

## API Endpoints

- `POST /api/init` - Manual Database Initialization
- `GET /api/config` - Get System Configuration
- `POST /api/config` - Update System Configuration
- `POST /api/login` - User Login
- `GET /api/subscriptions` - Get Subscription List
- `POST /api/subscriptions` - Create Subscription
- `PUT /api/subscriptions/:id` - Update Subscription
- `DELETE /api/subscriptions/:id` - Delete Subscription
- `GET /api/posts` - Get Article List
- `POST /api/process-rss` - Manual RSS Processing

## Environment Variables

Ensure the following environment variables are configured in Cloudflare Workers:
- `DB` - D1 Database Binding

## Scheduled Tasks

System configured to process RSS feeds every 10 minutes using Cloudflare Cron Triggers.
```json
"triggers": {
  "crons": ["*/10 * * * *"]
}
```
