# Deployment Guide

This guide will help you deploy the NodeSeek Monitor to Cloudflare Workers.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Install globally with `npm install -g wrangler`
3. **Telegram Bot**: Create a bot via [@BotFather](https://t.me/BotFather)
4. **Node.js**: Version 18 or higher

## Step-by-Step Deployment

### 1. Clone and Setup

```bash
git clone <your-repository-url>
cd nodeseek-monitor
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate with your Cloudflare account.

### 3. Create D1 Database

```bash
wrangler d1 create nodeseek-monitor
```

Copy the database ID from the output and update `wrangler.json`:

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "nodeseek-monitor",
      "database_id": "your-actual-database-id-here"
    }
  ]
}
```

### 4. Run Database Migrations

```bash
wrangler d1 migrations apply nodeseek-monitor
```

### 5. Deploy to Cloudflare Workers

```bash
pnpm run build
pnpm run deploy
```

### 6. Get Your Telegram Chat ID

1. Start a conversation with [@userinfobot](https://t.me/userinfobot)
2. Send any message to get your Chat ID
3. Save this ID for the next step

### 7. Initial Configuration

1. Visit your deployed application URL (shown after deployment)
2. Complete the initialization form:
   - Set your admin username and password
   - Enter your Telegram Chat ID
3. Login with your credentials

### 8. Configure Telegram Bot

1. Get your bot token from [@BotFather](https://t.me/BotFather)
2. In the dashboard, enter your bot token
3. Click "Set Webhook" to configure the bot
4. Test the bot by sending `/start` to your bot

### 9. Add Subscriptions

1. In the dashboard, add keyword subscriptions
2. Test RSS processing with the "Process RSS Now" button
3. Verify notifications are working

## Environment Variables

The application doesn't use traditional environment variables. All configuration is stored in the D1 database and managed through the web interface.

## Scheduled Tasks

The application automatically processes RSS feeds every 10 minutes using Cloudflare Cron Triggers. This is configured in `wrangler.json`:

```json
{
  "triggers": {
    "crons": ["*/10 * * * *"]
  }
}
```

## Monitoring and Logs

View logs and monitor your application:

```bash
wrangler tail
```

## Updating the Application

To update your deployment:

```bash
git pull origin main
npm install
pnpm run build
pnpm run deploy
```

## Database Management

### View Database Contents

```bash
wrangler d1 execute nodeseek-monitor --command "SELECT * FROM base_config;"
wrangler d1 execute nodeseek-monitor --command "SELECT * FROM keywords_sub;"
wrangler d1 execute nodeseek-monitor --command "SELECT * FROM posts ORDER BY created_at DESC LIMIT 10;"
```

### Backup Database

```bash
wrangler d1 export nodeseek-monitor --output backup.sql
```

### Reset Database

```bash
wrangler d1 migrations apply nodeseek-monitor --force
```

## Troubleshooting

### Common Issues

1. **Database ID not found**: Make sure you've updated `wrangler.json` with the correct database ID
2. **Webhook not working**: Ensure your bot token is correct and webhook URL is set
3. **RSS not processing**: Check the logs with `wrangler tail`
4. **Notifications not sending**: Verify your Chat ID and bot token

### Debug Commands

```bash
# View recent logs
wrangler tail

# Test database connection
wrangler d1 execute nodeseek-monitor --command "SELECT 1;"

# Check scheduled tasks
wrangler cron trigger --cron "*/10 * * * *"
```

## Security Considerations

1. **Admin Credentials**: Use strong username and password
2. **Bot Token**: Keep your bot token secure
3. **Chat ID**: Only share with trusted users
4. **Database Access**: Limit access to your Cloudflare account

## Cost Estimation

Cloudflare Workers pricing (as of 2024):

- **Workers**: 100,000 requests/day free, then $0.50/million requests
- **D1 Database**: 25 million row reads/month free, then $0.001/million reads
- **Cron Triggers**: 250,000 invocations/month free

For typical usage (checking RSS every 10 minutes), this should stay within free limits.