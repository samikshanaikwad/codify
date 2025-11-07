export default async function handler(req, res) {
  const webhook = process.env.N8N_WEBHOOK_URL;
  const token = process.env.CODIFY_SHARED_TOKEN;

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-codify-token": token } : {}),
    },
    body: JSON.stringify(req.body),
  });

  const text = await response.text();
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "*");
  res.status(200).send(text);
}
