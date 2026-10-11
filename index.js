import * as dgram from "node:dgram";
import * as dnspacket from "dns-packet";
import assert from "node:assert";

assert(process.env.NETWORK, "no network specified");
assert(process.env.ZT_KEY, "no api key specified");
assert(process.env.DOMAIN, "no domain specified");

const TTL = 300;

const NETWORK = process.env.NETWORK;
const ZT_KEY = process.env.ZT_KEY;
const DOMAIN = process.env.DOMAIN;

let lastFetch = 0;
let dnsTable = {};

async function lookup(query) {
  const now = Date.now();
  if (now - lastFetch > TTL * 1000) {
    const url = `https://api.zerotier.com/api/v1/network/${NETWORK}/member`;
    const params = { headers: { Authorization: `token ${ZT_KEY}` } };

    const response = await fetch(url, params);

    if (response.ok) {
      const data = await response.json();

      dnsTable = {};

      data.forEach((user) => {
        if (user.name && user.config.ipAssignments.length > 0)
          dnsTable[`${user.name}.${DOMAIN}`] = user.config.ipAssignments[0];
      });
    }

    lastFetch = now;
  }

  return dnsTable[query];
}

function sendError(port, address, id, rcode) {
  const answer = dnspacket.encode({
    type: "response",
    id: id,
    flags: rcode,
    questions: [],
    answers: [],
  });

  server.send(answer, port, address);
}

const server = dgram.createSocket("udp4");

server.on("message", async (msg, info) => {
  let query;

  try {
    query = dnspacket.decode(msg);
  } catch (err) {}

  if (query === undefined || query === null)
    return sendError(info.port, info.address, null, 1); // FORMERR

  try {
    if (query.questions === undefined || query.questions.length !== 1)
      return sendError(info.port, info.address, query.id, 1); // FORMERR

    const question = query.questions[0];

    if (!question.name.endsWith(`.${DOMAIN}`))
      return sendError(info.port, info.address, query.id, 3); // NXDOMAIN

    let resolved = await lookup(question.name);

    let answers =
      resolved !== undefined
        ? [
            {
              type: "A",
              class: "IN",
              name: question.name,
              ttl: TTL,
              data: resolved,
            },
          ]
        : [];

    const answer = dnspacket.encode({
      type: "response",
      id: query.id,
      flags: 0,
      questions: query.questions,
      answers: answers,
    });

    server.send(answer, info.port, info.address);
  } catch (err) {
    console.log(err);
    sendError(info.port, info.address, null, 2); // SERVFAIL
  }
});

server.on("listening", () => {
  const address = server.address();
  console.log(`Server listening on ${address.address}:${address.port}`);
});

server.bind(53, "0.0.0.0");
