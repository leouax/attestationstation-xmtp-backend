
import "dotenv/config";
import { Client } from "@xmtp/mls-client";
import * as fs from "fs";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { toBytes } from "viem";
import { generatePrivateKey } from "viem/accounts";
import cors from 'cors';
import express from 'express'
import https from 'https'
const app = express();
const port = 443

let urlToGroupId = {}

// read from storage file. in case server had to restart
// this file is used to store the urlToGroupId dictionary so that the data isnt lost in case the aws instance hosting the group chat stops or restarts
fs.readFile('storage.txt', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading from file:', err);
    } else {
	try {
            const dictionary = JSON.parse(data);
            urlToGroupId = dictionary;
            console.log('Storage loaded:', dictionary);
        } catch (parseErr) {
        console.log('loading failed, leaving urlToGroupId blank')
        console.log(parseError)
        }
    }
});


// Function to create a wallet from a private key
// used to create the main signer wallet
async function createWallet() {
  let key = process.env.KEY;
  if (!key) {
    key = generatePrivateKey();
    console.error(
      "KEY not set. Using random one. For using your own wallet , set the KEY environment variable.",
    );
    console.log("Random private key: ", key);
  }

  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({
    account,
    chain: mainnet,
    transport: http(),
  });
  console.log(`Init wallet ${account.address}`);
  return wallet;
}


// Function to create and setup the XMTP client
async function setupClient(wallet, config = {}) {
  let initialConfig = {
    env: "dev",
  };
  const finalConfig = { ...initialConfig, ...config };

  const client = await Client.create(wallet.account?.address, finalConfig);
  console.log("Inbox id: ", client.inboxId);
  return client;
}

// Function to register the client if not already registered
async function registerClient(client, wallet) {
  if (!client.isRegistered) {


    const signature = toBytes(
      await wallet.signMessage({
        message: client.signatureText,
      }),
    );
    client.addEcdsaSignature(signature);
    await client.registerIdentity();
  }
}

// write the urlToGroupId to storage. used every time a new group is created
async function writeDataToStorage() {
  fs.writeFile('storage.txt', JSON.stringify(urlToGroupId, null, 2), (err) => {
    if (err) {
	console.error('Error writing to file:', err);
    } else {
	console.log('Updated storage with new chat');
    }
});
}


// fetch messages for a conversation given a url
async function getMessagesByUrl(url) {
  const wallet = await createWallet();
    // Set up the XMTP client with the wallet and database path
    if (!fs.existsSync(`.cache`)) {
      fs.mkdirSync(`.cache`);
    }
  const client = await setupClient(wallet, {
      dbPath: `.cache/${wallet.account?.address}-${"prod"}`,
  });
  await registerClient(client, wallet);

  if (urlToGroupId[url] == undefined) {
    // if a group has not been created for url, make it \
    const conversation = await client.conversations.newConversation([
    ]);
    console.log("creating new group")
    urlToGroupId[url] = conversation.id
    // update dictionary to hard storage 
    await writeDataToStorage()
  }
  const convo = await client.conversations.getConversationById(urlToGroupId[url])
  return convo.messages()

}


app.use(cors({
  origin: '*', // Allow all URLs
  methods: 'GET,POST,PUT,DELETE,OPTIONS', // Allow specific HTTP methods
  allowedHeaders: 'Content-Type,Authorization' // Allow specific headers
}));

// Middleware
app.use(express.json());

// next three vars allow for the ssl/tcp certificate to host the server on https

const privateKey= `-----BEGIN RSA PRIVATE KEY-----
[redacted]
-----END RSA PRIVATE KEY-----`

const certificate = `-----BEGIN CERTIFICATE-----
[redacted]
-----END CERTIFICATE-----`

const ca = `-----BEGIN CERTIFICATE-----
[redacted]
-----END CERTIFICATE-----`


const credentials = { key: privateKey, cert: certificate, ca: ca };


// Route handling string input via query parameter
// listen for api calls (message send or read requests)
app.get('/api/fetch', async (req, res) => {

const wallet = await createWallet();

  const url = req.query.url;
  // if a message is defined, send it
  if (req.query.msg) {
    try {
      const msg = req.query.msg
      console.log('received msg send rq:' + req.query.msg)
      console.log("url:" + req.query.url)

      // Set up the XMTP client with the wallet and database path
      if (!fs.existsSync(`.cache`)) {
        fs.mkdirSync(`.cache`);
      }
      const client = await setupClient(wallet, {
        dbPath: `.cache/${wallet.account?.address}-${"prod"}`,
      });
      await registerClient(client, wallet);
      const convo = await client.conversations.getConversationById(urlToGroupId[url])
      console.log(convo)
      await convo.send(msg)
      res.json("successfully sent message")
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: 'An unexpected error occurred.' });
      // test
    }
  // if a message is not defined, return a json object of the conversation for the given url
  } else {
    try {

      console.log("received a request!");
       // Access query parameter 'url'
      if (typeof url === 'string') {
        const data = await getMessagesByUrl(url);
        res.json(data);
      } else {
        res.status(400).json({ error: 'url query parameter is required and must be a string.' });
      }
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: 'An unexpected error occurred.' });
    }
  }
});

// now host the server on https 
https.createServer(credentials, app).listen(port, () => {
    console.log(`Backend server running on https://localhost:${port}`);
});

