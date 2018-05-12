import Slack from 'slack-node';


const slack = new Slack();
slack.setWebhook(process.env.SLACK_WEBHOOK_URL);

export default ( text, username = 'web-server-events' ) => {
  // NOTE: Deprecated for now
  // slack.webhook({
  //   channel: `#${process.env.SLACK_WEBHOOK_CHANNEL}`,
  //   username,
  //   text,
  // }, () => {});
};
