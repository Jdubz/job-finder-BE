# Monitoring and Observability Guide

This guide covers monitoring, logging, and observability for the Job Finder Backend deployed on Firebase Cloud Functions.

## Table of Contents

- [Overview](#overview)
- [Monitoring Setup](#monitoring-setup)
- [Key Metrics](#key-metrics)
- [Logging](#logging)
- [Alerting](#alerting)
- [Dashboards](#dashboards)
- [Troubleshooting](#troubleshooting)

## Overview

The Job Finder Backend uses multiple Google Cloud Platform services for monitoring and observability:

- **Cloud Logging**: Centralized log management
- **Cloud Monitoring**: Metrics, dashboards, and alerts
- **Firebase Console**: Function-specific monitoring
- **Error Reporting**: Automatic error aggregation

## Monitoring Setup

### Enable Required APIs

Ensure these APIs are enabled in your Google Cloud project:

```bash
gcloud services enable logging.googleapis.com
gcloud services enable monitoring.googleapis.com
gcloud services enable cloudtrace.googleapis.com
```

### Configure Log Levels

Set the log level for your environment:

**Staging**: `debug` or `info` for detailed logging
**Production**: `info` or `warn` to reduce costs

Configure in your function:
```typescript
import { setLogLevel } from './utils/logger';

// In function initialization
setLogLevel(process.env.LOG_LEVEL || 'info');
```

## Key Metrics

### Function Execution Metrics

Monitor these metrics for each Cloud Function:

#### Invocation Count
- **Metric**: `cloudfunctions.googleapis.com/function/execution_count`
- **What to watch**: Sudden spikes or drops
- **Threshold**: Alert if count drops to zero unexpectedly

#### Execution Time
- **Metric**: `cloudfunctions.googleapis.com/function/execution_times`
- **What to watch**: p50, p95, p99 latencies
- **Threshold**: 
  - p95 > 5 seconds (warning)
  - p99 > 10 seconds (critical)

#### Error Rate
- **Metric**: `cloudfunctions.googleapis.com/function/execution_count` (with status=error)
- **What to watch**: Percentage of failed executions
- **Threshold**:
  - Error rate > 1% (warning)
  - Error rate > 5% (critical)

#### Memory Usage
- **Metric**: `cloudfunctions.googleapis.com/function/user_memory_bytes`
- **What to watch**: Peak memory usage vs allocated memory
- **Threshold**: > 90% of allocated memory

#### Cold Starts
- **Metric**: `cloudfunctions.googleapis.com/function/execution_count` (with cold_start=true)
- **What to watch**: Frequency of cold starts
- **Threshold**: > 20% of requests experiencing cold starts

### Firestore Metrics

#### Read/Write Operations
- **Metric**: `firestore.googleapis.com/document/read_count`
- **What to watch**: Query efficiency, unexpected growth
- **Threshold**: Daily quota approaching limit

#### Document Count
- **Metric**: Track via custom logging
- **What to watch**: Collection growth rate
- **Threshold**: Unusual growth patterns

### Storage Metrics

#### Storage Usage
- **Metric**: `storage.googleapis.com/storage/total_bytes`
- **What to watch**: Total storage consumption
- **Threshold**: > 90% of quota

#### Bandwidth Usage
- **Metric**: `storage.googleapis.com/network/sent_bytes_count`
- **What to watch**: Data transfer costs
- **Threshold**: Unexpected spikes

## Logging

### Log Levels

Use appropriate log levels:

- **DEBUG**: Detailed debugging information
- **INFO**: General informational messages
- **WARN**: Warning messages for potential issues
- **ERROR**: Error messages for failures

### Structured Logging

All logs use structured JSON format:

```typescript
import { logger } from './utils/logger';

logger.info('Job submitted', {
  userId: 'user123',
  jobId: 'job456',
  url: 'https://example.com/job'
});
```

### Viewing Logs

#### Via Firebase Console

1. Go to Firebase Console
2. Select your project
3. Navigate to Functions → Select function → Logs

#### Via Cloud Logging

1. Go to Cloud Console → Logging → Logs Explorer
2. Use queries to filter logs:

```
# All function logs
resource.type="cloud_function"

# Specific function
resource.type="cloud_function"
resource.labels.function_name="manageJobQueue"

# Error logs only
resource.type="cloud_function"
severity="ERROR"

# Logs for specific user
resource.type="cloud_function"
jsonPayload.userId="user123"

# Slow requests (>5s)
resource.type="cloud_function"
jsonPayload.executionTime>5000
```

#### Via Firebase CLI

```bash
# View all function logs
firebase functions:log

# View specific function
firebase functions:log --only manageJobQueue

# Follow logs in real-time
firebase functions:log --only manageJobQueue --follow

# Limit number of lines
firebase functions:log --lines 100
```

### Log Retention

- **Cloud Logging**: 30 days by default
- **Extended Retention**: Configure log sinks to Cloud Storage or BigQuery

Set up log sink:
```bash
gcloud logging sinks create my-sink \
  storage.googleapis.com/my-log-bucket \
  --log-filter='resource.type="cloud_function"'
```

## Alerting

### Alert Policies

Create alert policies for critical conditions:

#### High Error Rate

```yaml
Condition: Error rate > 5%
Duration: 5 minutes
Notification: Email, Slack
Severity: Critical
```

#### Slow Response Time

```yaml
Condition: p95 latency > 10 seconds
Duration: 5 minutes
Notification: Email
Severity: Warning
```

#### Function Unavailable

```yaml
Condition: Invocation count = 0
Duration: 10 minutes
Notification: Email, Slack, PagerDuty
Severity: Critical
```

#### High Memory Usage

```yaml
Condition: Memory usage > 90%
Duration: 5 minutes
Notification: Email
Severity: Warning
```

### Creating Alerts via Console

1. Go to Cloud Console → Monitoring → Alerting
2. Click "Create Policy"
3. Configure condition, notification, and documentation

### Creating Alerts via CLI

```bash
# Create alert policy
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-expression='
    resource.type = "cloud_function" AND
    metric.type = "cloudfunctions.googleapis.com/function/execution_count" AND
    metric.label.status = "error"
  ' \
  --condition-threshold-value=5 \
  --condition-threshold-duration=300s
```

### Notification Channels

Configure notification channels:

- **Email**: Direct email alerts
- **Slack**: Webhook integration
- **PagerDuty**: For on-call rotations
- **SMS**: For critical alerts

Set up Slack webhook:
```bash
gcloud alpha monitoring channels create \
  --display-name="Team Slack" \
  --type=slack \
  --channel-labels=url=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## Dashboards

### Default Dashboard

Firebase Console provides a basic dashboard with:
- Invocation count
- Execution time
- Error rate
- Active instances

### Custom Dashboards

Create custom dashboards in Cloud Console:

1. Go to Cloud Console → Monitoring → Dashboards
2. Click "Create Dashboard"
3. Add charts for your metrics

#### Recommended Dashboard Widgets

**Function Performance Dashboard**:
- Invocation count (line chart)
- Execution time percentiles (line chart, p50/p95/p99)
- Error rate (line chart)
- Memory usage (stacked area chart)
- Cold starts (bar chart)

**User Activity Dashboard**:
- Jobs submitted per hour (line chart)
- Active users (gauge)
- Documents generated (counter)
- API response times (heatmap)

**Resource Usage Dashboard**:
- Firestore reads/writes (line chart)
- Storage usage (gauge)
- Secret Manager calls (line chart)
- Estimated costs (scorecard)

### Sample Dashboard Configuration

```json
{
  "displayName": "Job Finder Backend - Production",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Function Invocations",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloud_function\" metric.type=\"cloudfunctions.googleapis.com/function/execution_count\""
                }
              }
            }]
          }
        }
      }
    ]
  }
}
```

## Troubleshooting

### High Error Rates

**Investigation Steps**:
1. Check error logs: Filter by `severity="ERROR"`
2. Identify error patterns: Group by error message
3. Check recent deployments: Correlate with deployment times
4. Review code changes: Check recent commits

**Common Causes**:
- Invalid input data
- Missing secrets or configuration
- External API failures
- Database connection issues

### Slow Performance

**Investigation Steps**:
1. Check execution time logs
2. Identify slow functions: Sort by execution time
3. Profile function code: Add timing logs
4. Check external API latency

**Common Causes**:
- Cold starts (optimize initialization)
- Slow database queries (add indexes)
- External API timeouts (add timeouts/retries)
- Large payload processing (optimize)

### High Memory Usage

**Investigation Steps**:
1. Check memory metrics
2. Profile memory-intensive operations
3. Review data processing logic

**Solutions**:
- Increase allocated memory
- Optimize data processing
- Stream large files instead of loading into memory
- Implement pagination for large datasets

### Missing Logs

**Investigation Steps**:
1. Check log level configuration
2. Verify logger is imported correctly
3. Check Cloud Logging quotas

**Solutions**:
- Ensure logs are written using structured logger
- Check if logs are being filtered
- Verify IAM permissions for logging

## Best Practices

### Logging Best Practices

1. **Use structured logging**: Always log JSON objects
2. **Include context**: Add userId, requestId, jobId, etc.
3. **Avoid PII**: Don't log sensitive user data
4. **Use appropriate levels**: Don't use ERROR for warnings
5. **Add correlation IDs**: Track requests across services

### Monitoring Best Practices

1. **Set up alerts early**: Don't wait for problems
2. **Define SLOs**: Know what "good" looks like
3. **Monitor trends**: Not just absolute values
4. **Review regularly**: Check dashboards weekly
5. **Document runbooks**: How to respond to alerts

### Cost Optimization

1. **Use appropriate log levels**: Debug logs are expensive
2. **Set log retention**: Don't keep logs forever
3. **Sample high-volume logs**: Not every request needs full logging
4. **Use log sinks**: Archive to cheaper storage
5. **Monitor quota usage**: Stay within free tier when possible

## Useful Queries

### Find Slow Requests

```
resource.type="cloud_function"
jsonPayload.executionTime > 5000
```

### Find Authentication Failures

```
resource.type="cloud_function"
jsonPayload.error =~ ".*unauthorized.*"
```

### Find Specific User Activity

```
resource.type="cloud_function"
jsonPayload.userId="USER_ID"
```

### Count Errors by Type

```
resource.type="cloud_function"
severity="ERROR"
```

Group by: `jsonPayload.error`

### Track API Usage

```
resource.type="cloud_function"
jsonPayload.requestPath=~".*"
```

Group by: `jsonPayload.requestPath`

## Resources

- [Cloud Logging Documentation](https://cloud.google.com/logging/docs)
- [Cloud Monitoring Documentation](https://cloud.google.com/monitoring/docs)
- [Firebase Functions Monitoring](https://firebase.google.com/docs/functions/writing-and-viewing-logs)
- [Cloud Trace](https://cloud.google.com/trace/docs)

---

For questions or issues, contact the development team or create an issue in the repository.
