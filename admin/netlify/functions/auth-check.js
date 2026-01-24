const { verifyAuth } = require('./utils/auth');

exports.handler = async (event) => {
  const authenticated = verifyAuth(event);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authenticated })
  };
};
