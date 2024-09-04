# XMTP Backend for Attestation Station 

NOTICE: This repository is here for the sole purpose of being read by the xmtp partners of the ETHOnline 2024 hackathon 

This is the code of the server hosting the xmtp client for AttestationStation. Because there wasn't yet a v3 web sdk and v2 doesn't support group chats, this couldn't be built directly into the frontend and thus had to be built remotely. This server is hosted on aws, and interacts with the frontend via api calls. 

AttestationStation has a conversation (or group chat, if you will) for every url that users search. The server stores a dictionary in the form of ```{url:group_id}``` containing the correspoding group chat identifiers for each url. When someone searches up a url that hasn't yet been given a group chat, an api call is made and the server creates a group chat correspoding to that specific url.  

When reading messages for a url, an api call is made and a json object of messages is returned that are then displayed on the frontend. 

When someone sends a message, an api call is made and the server sends it on their behalf. This is once again because of v2 limitations and because you can't pass the window.ethereum signer in an api call. Yes, this isn't ideal. Once a web v3 sdk is released everything will be rewritten to have users sign & send their own messages. 

Now let's inspect the code: 



