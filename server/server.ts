import express, { Express, Request, Response } from "express";
import cors from "cors";
import config from "config";
import fs, { read } from "fs";
import crypto from "crypto"
import readline from "readline"

const port = config.get("port");

function generateSessionId() {
  const arr = crypto.randomBytes(32);
  return Array.from(arr, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function checkFile(filePath: string) {
  let isExist = false;
  try {
    fs.statSync(filePath);
    isExist = true;
  } catch(err) {
    isExist = false;
  }
  return isExist;
}

function writeFile(filePath: string, stream: string) {
  try {
    fs.writeFileSync(filePath, stream);
    return true;
  } catch(err) {
    return false;
  }
}

function readFile(filePath: string) {
  let content = new String();
  if(checkFile(filePath)) {;
    content = fs.readFileSync(filePath, 'utf8');
  }
  return content;
}

let AOTCdata: Map<number, string> = new Map();
function AlwaysOnTopConsole(stream: string, line: number) {
    AOTCdata.set(line, stream);
}

const app = express();

app.use(express.json());
app.use("/contents", express.static('./../contentsroot'))
app.use("/", express.static('./../websiteroot'))
const commoncorsOptions = {
  origin: 'http://localhost:5173', // 許可したいオリジンを指定
  credentials: true, // レスポンスヘッダーにAccess-Control-Allow-Credentialsを追加。ユーザー認証等を行う場合は、これがないとブラウザがレスポンスを捨ててしまうそう。
  optionsSuccessStatus: 200, // レスポンスのHTTPステータスコードを「200(成功)」に設定
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}
app.use(cors(commoncorsOptions))

const Files = fs.readdirSync("./mdEditor/");
let FileStatus: { [keys: string]: { isEditing: boolean, editor: string, timeOut: number } } = {}
Files.forEach((value, index, array) => {
    FileStatus[value] = {
        isEditing: false,
        editor: "",
        timeOut: 0
    }
})

app.get("/api/mdEditor/getAllFileNames", (req, res) => {
    console.log("Requested GET to '/api/mdEditor/getAllFileNames'");
    res.header('Content-Type', 'application/json; charset=utf-8')
    res.send({
            files: Files
        });
})

app.post("/api/mdEditor/:FileName/RequestEdit", (req, res) => {
    console.log(`Requested POST to '/api/mdEditor/${req.params.FileName}/RequestEdit'`);
    res.header('Content-Type', 'application/json; charset=utf-8')
    const fileName = req.params.FileName;
    if (!FileStatus[fileName]?.isEditing) {
        console.log(`[POST('/api/mdEditor/${req.params.FileName}/RequestEdit')] Responced HTTP status: 200`);
        const sessionId = generateSessionId();
        res.send({
            permission: true,
            editor: sessionId
        })
        FileStatus[fileName] = {
            isEditing: true,
            editor: sessionId,
            timeOut: Date.now() + 5 * 60 * 1000
        }
        return;
    }
    console.log(`[POST('/api/mdEditor/${req.params.FileName}/RequestEdit')] Responced HTTP status: 404`);
    res.status(404).send({
        permission: false
    })
})

app.get("/api/mdEditor/:FileName/Contents", (req, res) => {
    console.log(`Requested GET to '/api/mdEditor/${req.params.FileName}/Contents'`);
    res.header('Content-Type', 'application/json; charset=utf-8')
    const fileName = req.params.FileName;
    if (FileStatus[fileName] === undefined) {
        console.log(`[GET('/api/mdEditor/${req.params.FileName}/Contents')] Responced HTTP status: 404`);
        res.status(404).send()
        return;
    }
    console.log(`[GET('/api/mdEditor/${req.params.FileName}/Contents')] Responced HTTP status: 200`);
    res.send({
        contents: readFile(`./mdEditor/${fileName}`)
    })
})

app.put("/api/mdEditor/:FileName/EndEdit", (req, res) => {
    console.log(`Requested PUT to '/api/mdEditor/${req.params.FileName}/EndEdit'`);
    const fileName = req.params.FileName;
    if (FileStatus[fileName] === undefined) {
        console.log(`[PUT('/api/mdEditor/${req.params.FileName}/EndEdit')] Responced HTTP status: 404`);
        res.status(404).send();
        return;
    }
    FileStatus[fileName].isEditing = false;
    console.log(`[PUT('/api/mdEditor/${req.params.FileName}/EndEdit')] Responced HTTP status: 200`);
    res.status(200).send();
})

app.post("/api/mdEditor/:FileName/Edited", (req, res) => {
    console.log(`Requested POST to '/api/mdEditor/${req.params.FileName}/Edited'`);
    res.header('Content-Type', 'application/json; charset=utf-8')
    const fileName = req.params.FileName;
    const sessionId = req.body.session;

    AlwaysOnTopConsole(`| content0.md { editor: ${FileStatus["content0.md"]?.editor} , isEditing: ${FileStatus["content0.md"]?.isEditing} }`, 0);
    AlwaysOnTopConsole(`| content1.md { editor: ${FileStatus["content1.md"]?.editor} , isEditing: ${FileStatus["content1.md"]?.isEditing} }`, 1);
    AlwaysOnTopConsole(`| Requested file name: ${fileName}, Sent session: ${sessionId}`, 2);

    if (FileStatus[fileName] === undefined) {
        console.log(`[POST('/api/mdEditor/${req.params.FileName}/Edited')] Responced HTTP status: 404`);
        res.status(404).send();
        return;
    }
    if (FileStatus[fileName].isEditing && FileStatus[fileName].editor === sessionId) {
        console.log(`[POST('/api/mdEditor/${req.params.FileName}/Edited')] Responced HTTP status: 200`);
        FileStatus[fileName].timeOut = Date.now() + 5 * 60 * 1000;
        writeFile(`./mdEditor/${fileName}`, req.body.contents)
        res.status(200).send()
    }
    else {
        console.log(`[POST('/api/mdEditor/${req.params.FileName}/Edited')] Responced HTTP status: 403`);
        res.status(403).send();
    }
})

setInterval(() => {
    Files.forEach((fileName, index, array) => {
        if (FileStatus[fileName] === undefined) return;
        if (FileStatus[fileName].timeOut < Date.now()) FileStatus[fileName].isEditing = false;
    })
    
    // AOTCdata.keys().forEach(( line, index ) => {
    //     const stream = AOTCdata.get(line);
    //     if (stream === undefined) return;
    //     readline.cursorTo(process.stdout, 0, line);
    //     readline.clearLine(process.stdout, 0);
    //     process.stdout.write(stream);
    //     readline.cursorTo(process.stdout, 0, process.stdout.rows - 1);
    // })
}, 100)

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})


app.options(/.*/, cors());
