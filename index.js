
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
    await writeDataToStorage()
  }
  const convo = await client.conversations.getConversationById(urlToGroupId[url])
  //await convo.send("lmfao")
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
MIIEogIBAAKCAQEAg+dJjyOX79wh9r2nmVTYTWD0hMyhqnbEEbNGhSiAc6CqUnKT
xhWJWe9AzDKKdFn+lZ6TBdMFdOAE4KG2FTtrZgyxFy5olxg5EzaaYB/hkmiXRnYJ
JnDQz3GSRNSThiFPFEiIREB7dJLwML5ay0WRYDpQ4sCRJWMReYn2GqvYOIagfAK5
+1N4cjJ/u+W/q7nE0+koG6K54mO4Poe9G79JNQKocsM5lZ8M54AMzLY70VBCNYWP
RNyIFOE+HB4Ms2omxhBADWrUFjhqqG3D1GLVbfUySL8AjP13NWbb7Zr32eB6JrKn
MlId0jugimXiHTTeUrocak1OQ3DxxzjBlmT5awIDAQABAoIBAHOULN6iH7Zru88L
LFqs/8P92wSqklZeLzwbTQXNEZFADT6la1s879fAT5UeDDgby3qrMsT9vWBGE8AJ
sxUztc37/QkE/1y2Ovzc8bSc+vlhcHyrXSUz4aSELdjmNEZp1XM+gzjbD9J8Fr9/
bOuFD/ez4cBvYD/UaTGIc/+26IXOFiXlsxvn8j6BP7Rxr7FmJHeVBSQna2ujPuUQ
74FUxbMIM/+fDMFoH5LO5eDSSw9Jvke64HYhgnHlmWtmoBEVKwgl5UwYzTh8HfkL
6jXd7gTgmsXCGq//4CLCW/9NmLt3nHVG6yBypaElPzK9wuKTDtT0FDHPU+3R70ay
uQLgb5ECgYEA6k7F6ejjZGFubkFlSYpcHJsbAX0C6BYx/uTB5vnrU7js5WIhzhbM
Et5cCGyjTxcqHxiShNgt+B9auA9eGGHbQpFAT3cuzrlrzdUIslYo2fSvdNDSrqFw
bEhWOLgatmH5rF5QZxApITMIrZiQNNYDrvM65zFOKtDgrkPsiMLkI5cCgYEAkB15
nTxa9MTZlMrIVxbq0CFeLH+zpCuwSmjiyJjDiAjyTt2ndEjMmz9YxyI972dcqxKj
NSUI0tSU0ZkX9LZRvL93jQGNw6Wr1gP8jSyg1fPMvrud9zyhAS2fS9XfJ9Skdidy
cuKXX42BkTNYByFYP3dOl/4cGSUF8puev4Twg00CgYAB4Wv5OqNIlPeb7u5vLqsa
l6wZ0PULA9KW5yMfRXY8D8nm9WisDMbKh/pZHvYYlmkCIuJaKpoD2cySmZz5uR9X
Y28OtDgt9JMG7eTJ+aMOTMZzu5FVUXpjhBkdD203dYXZelBO43RRDeXN7uGJawZQ
iyc3389uzIphG650UoweNQKBgBdSjdHiaJ3gFY482vstHEcef00YRYw1/cus+baY
8lvbhss4l9b7yRD+yXFAm2FZCugslfkNy0XDXWomKnhR4Rx4p/JL5BNbhlmWP5Lh
PA4j7GiZmFDgoPW92l+9duXNRehRLfZlsTWnguZqtr5AqTVsK23xk76F/VZr1N8N
tpapAoGAYMOGQVhl5MztK842tK/M/ibfXkA7YGi26Kes8o9xDdhr3VSLV+a9wvbj
pP68sSS91OFYoYpTP8cRkNRmCE7KTtjwPLYIXFPWGfBBQODd3DTW/1b85RfTAC74
3E38MN85V78uTk8K6Gn7samB+q9D4+fmNXPIAz0Pb68wfHI67IU=
-----END RSA PRIVATE KEY-----`

const certificate = `-----BEGIN CERTIFICATE-----
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
xAM=
-----END CERTIFICATE-----`

const ca = `-----BEGIN CERTIFICATE-----
MIIG1TCCBL2gAwIBAgIQbFWr29AHksedBwzYEZ7WvzANBgkqhkiG9w0BAQwFADCB
iDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0pl
cnNleSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNV
BAMTJVVTRVJUcnVzdCBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMjAw
MTMwMDAwMDAwWhcNMzAwMTI5MjM1OTU5WjBLMQswCQYDVQQGEwJBVDEQMA4GA1UE
ChMHWmVyb1NTTDEqMCgGA1UEAxMhWmVyb1NTTCBSU0EgRG9tYWluIFNlY3VyZSBT
aXRlIENBMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAhmlzfqO1Mdgj
4W3dpBPTVBX1AuvcAyG1fl0dUnw/MeueCWzRWTheZ35LVo91kLI3DDVaZKW+TBAs
JBjEbYmMwcWSTWYCg5334SF0+ctDAsFxsX+rTDh9kSrG/4mp6OShubLaEIUJiZo4
t873TuSd0Wj5DWt3DtpAG8T35l/v+xrN8ub8PSSoX5Vkgw+jWf4KQtNvUFLDq8mF
WhUnPL6jHAADXpvs4lTNYwOtx9yQtbpxwSt7QJY1+ICrmRJB6BuKRt/jfDJF9Jsc
RQVlHIxQdKAJl7oaVnXgDkqtk2qddd3kCDXd74gv813G91z7CjsGyJ93oJIlNS3U
gFbD6V54JMgZ3rSmotYbz98oZxX7MKbtCm1aJ/q+hTv2YK1yMxrnfcieKmOYBbFD
hnW5O6RMA703dBK92j6XRN2EttLkQuujZgy+jXRKtaWMIlkNkWJmOiHmErQngHvt
iNkIcjJumq1ddFX4iaTI40a6zgvIBtxFeDs2RfcaH73er7ctNUUqgQT5rFgJhMmF
x76rQgB5OZUkodb5k2ex7P+Gu4J86bS15094UuYcV09hVeknmTh5Ex9CBKipLS2W
2wKBakf+aVYnNCU6S0nASqt2xrZpGC1v7v6DhuepyyJtn3qSV2PoBiU5Sql+aARp
wUibQMGm44gjyNDqDlVp+ShLQlUH9x8CAwEAAaOCAXUwggFxMB8GA1UdIwQYMBaA
FFN5v1qqK0rPVIDh2JvAnfKyA2bLMB0GA1UdDgQWBBTI2XhootkZaNU9ct5fCj7c
tYaGpjAOBgNVHQ8BAf8EBAMCAYYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHSUE
FjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwIgYDVR0gBBswGTANBgsrBgEEAbIxAQIC
TjAIBgZngQwBAgEwUAYDVR0fBEkwRzBFoEOgQYY/aHR0cDovL2NybC51c2VydHJ1
c3QuY29tL1VTRVJUcnVzdFJTQUNlcnRpZmljYXRpb25BdXRob3JpdHkuY3JsMHYG
CCsGAQUFBwEBBGowaDA/BggrBgEFBQcwAoYzaHR0cDovL2NydC51c2VydHJ1c3Qu
Y29tL1VTRVJUcnVzdFJTQUFkZFRydXN0Q0EuY3J0MCUGCCsGAQUFBzABhhlodHRw
Oi8vb2NzcC51c2VydHJ1c3QuY29tMA0GCSqGSIb3DQEBDAUAA4ICAQAVDwoIzQDV
ercT0eYqZjBNJ8VNWwVFlQOtZERqn5iWnEVaLZZdzxlbvz2Fx0ExUNuUEgYkIVM4
YocKkCQ7hO5noicoq/DrEYH5IuNcuW1I8JJZ9DLuB1fYvIHlZ2JG46iNbVKA3ygA
Ez86RvDQlt2C494qqPVItRjrz9YlJEGT0DrttyApq0YLFDzf+Z1pkMhh7c+7fXeJ
qmIhfJpduKc8HEQkYQQShen426S3H0JrIAbKcBCiyYFuOhfyvuwVCFDfFvrjADjd
4jX1uQXd161IyFRbm89s2Oj5oU1wDYz5sx+hoCuh6lSs+/uPuWomIq3y1GDFNafW
+LsHBU16lQo5Q2yh25laQsKRgyPmMpHJ98edm6y2sHUabASmRHxvGiuwwE25aDU0
2SAeepyImJ2CzB80YG7WxlynHqNhpE7xfC7PzQlLgmfEHdU+tHFeQazRQnrFkW2W
kqRGIq7cKRnyypvjPMkjeiV9lRdAM9fSJvsB3svUuu1coIG1xxI1yegoGM4r5QP4
RGIVvYaiI76C0djoSbQ/dkIUUXQuB8AL5jyH34g3BZaaXyvpmnV4ilppMXVAnAYG
ON51WhJ6W0xNdNJwzYASZYH+tmCWI+N60Gv2NNMGHwMZ7e9bXgzUCZH5FaBFDGR5
S9VWqHB73Q+OyIVvIbKYcSc2w/aSuFKGSA==
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

https.createServer(credentials, app).listen(port, () => {
    console.log(`Backend server running on https://localhost:${port}`);
});

