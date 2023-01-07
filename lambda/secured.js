exports.handler = async function(event) {
  console.log("request:", JSON.stringify(event, undefined, 2));
  return {
    statusCode: 200,
    headers: { 
      "Content-Type": "text/plain",
      "Access-Control-Allow-Headers": 'Authorization',
      "Access-Control-Allow-Methods": 'GET',
      "Access-Control-Allow-Origin": '*'
    },
    body: `Hello to you, authenticated users! You've hit ${event.path}\nIf you see this your request went through`
  };
};