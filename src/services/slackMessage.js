import Slack from 'slack-node';


const slack = new Slack();
slack.setWebhook(process.env.SLACK_WEBHOOK_URL);

export default ( text, username = 'web-server-events' ) => {
  slack.webhook({
    channel: '#web-events',
    username,
    text,
  }, () => {});
};
