import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

const SESSION_DIR = "data/wa-session";
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
  puppeteer: {
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
           "--disable-blink-features=AutomationControlled"],
  },
  authTimeoutMs: 300000,
  takeoverOnConflict: true,
});

client.on("ready", async () => {
  console.log("Client READY");
  await new Promise(r => setTimeout(r, 5000));

  const number = "2347061901541";
  
  const result = await client.pupPage.evaluate(async (number) => {
    const { Chat, Msg } = window.require("WAWebCollections");
    const { createWid } = window.require("WAWebWidFactory");
    const { findOrCreateLatestChat } = window.require("WAWebFindChatAction");
    const { addAndSendMsgToChat } = window.require("WAWebSendMsgChatAction");
    const { newId } = window.require("WAWebMsgKey");
    const { getMaybeMePnUser, getMaybeMeLidUser } = window.require("WAWebUserPrefsMeUser");
    const { getPhoneNumber } = window.require("WAWebApiContact");
    
    const mePn = getMaybeMePnUser();
    const meLid = getMaybeMeLidUser();
    
    const chatIdPN = number + "@c.us";
    const chatWidPN = createWid(chatIdPN);
    
    // Check if the phone number WID has a LID mapping
    let pnToLid = null;
    try {
      pnToLid = getPhoneNumber(chatWidPN);
    } catch(e) {
      pnToLid = "ERROR: " + e.message;
    }
    
    // Check LID cache
    let lidCacheInfo = null;
    try {
      const { WaWebLidPnCache } = window.require("WAWebLidPnCache");
      lidCacheInfo = "module found";
    } catch(e) {
      lidCacheInfo = e.message;
    }
    
    // Try to resolve using queryWidExists
    let queryResult = null;
    try {
      const { queryWidExists } = window.require("WAWebQueryExistsJob");
      queryResult = await queryWidExists(chatWidPN);
    } catch(e) {
      queryResult = "ERROR: " + e.message;
    }
    
    // Check if there's a lid-to-pn mapping we can use
    let lidMapping = null;
    try {
      const LidPnCache = window.require("WAWebLidPnCache");
      lidMapping = Object.keys(LidPnCache).filter(k => typeof LidPnCache[k] === 'function').join(", ");
    } catch(e) {
      lidMapping = e.message;
    }
    
    // Try to use WAWebFindChatAction with LID
    let lidChat = null;
    try {
      const lidId = "47897542422772@lid";
      const lidWid = createWid(lidId);
      lidChat = (await findOrCreateLatestChat(lidWid))?.chat;
    } catch(e) {
      lidChat = "ERROR: " + e.message;
    }
    
    // Try sending with addressingMode override
    let sendViaLid = null;
    try {
      const lidId = "47897542422772@lid";
      const lidWid = createWid(lidId);
      const chat = (await findOrCreateLatestChat(lidWid))?.chat;
      
      if (chat) {
        const id = await newId();
        const from = mePn;
        
        const msgKey = new (window.require("WAWebMsgKey"))({
          from: from,
          to: lidWid,
          id: id,
          selfDir: "out",
        });
        
        const message = {
          id: msgKey,
          ack: 0,
          body: "Hello via LID addressing",
          from: from,
          to: lidWid,
          local: true,
          self: "out",
          t: parseInt(new Date().getTime() / 1000),
          isNewMsg: true,
          type: "chat",
          addressingMode: "lid",
        };
        
        const [msgPromise, sendResultPromise] = addAndSendMsgToChat(chat, message);
        await msgPromise;
        sendViaLid = await sendResultPromise;
      } else {
        sendViaLid = "no chat found";
      }
    } catch(e) {
      sendViaLid = "THROW: " + e.name + ": " + e.message;
    }
    
    return {
      mePn: mePn?._serialized,
      meLid: meLid?._serialized,
      pnToLid: typeof pnToLid === 'string' ? pnToLid : pnToLid?._serialized,
      queryResult: typeof queryResult === 'string' ? queryResult : JSON.stringify(queryResult),
      lidMapping,
      lidChatFound: !!lidChat,
      sendViaLid: typeof sendViaLid === 'string' ? sendViaLid : JSON.stringify(sendViaLid),
    };
  }, number);
  
  console.log(JSON.stringify(result, null, 2));
  
  await client.destroy();
  process.exit(0);
});

client.on("disconnected", (r) => console.log("Disconnected:", r));
console.log("Initializing...");
client.initialize();
