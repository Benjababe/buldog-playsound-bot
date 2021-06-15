const etc = require("./etc"),
      psHandler = require("./playsound_handler"),
      creds = require("./private/credentials.json");

const hostURL = "https://Buldog-Playsound-Bot.benjababe.repl.co",
      generatedURL = hostURL + "/playsounds/generated/",
      customURL = hostURL + "/playsounds/custom/",
      playsoundJSONPath = "./private/playsounds.json";

const fs = require("fs");

const sources = {
    "lacari": "lagari",
    "lagari": "lagari",
    "cs":     "custom",
    "custom": "custom"
}

const nsfw = ["daym"];

class CommentJob {
    constructor(item) {
        this.item = item;
        this.reply = "";
    }
}

module.exports.parse = async (item, isPost = false) => {
    let psJobs = [],
        comment = ((isPost) ? item.title.trim() : item.body.trim()).split(" "),
        i = comment.indexOf("!playsound");

    // 1: find streamer name
    // 2: find playsound name
    // 3: find playsound speed
    let stage = 1,
        streamer = undefined,
        playsound = undefined,
        speed = 1,
        soundData = fs.readFileSync(playsoundJSONPath),
        sounds = JSON.parse(soundData);

    // if comment doesn't have the playsound command
    // or if already replied to command
    let commented = await checkCommented(item);
    if (!comment.includes("!playsound") || commented)
        return;

    while (comment[0] != "!playsound")
        comment.shift();
    comment.shift();

    while (comment.length > 0 || (streamer != undefined && playsound != undefined && stage == 4)) {
        if (stage == 1) {
            //streamer defaults to buldog
            streamer = Object.keys(sources).includes(comment[0]) ? sources[comment.shift()] : "buldog";
            stage++;
        }

        else if (stage == 2) {
            playsound = comment.shift();

            // if playsound doesn't exist
            if (sounds[streamer][playsound] == undefined) {
                playsound = undefined
                break;
            }

            stage++;
        }

        else if (stage == 3) {
            if (isFloat(comment[0]))
                speed = parseFloat(comment.shift());
            stage++;
        }

        else if (stage == 4) {
            psJobs.push([streamer, playsound, speed]);

            // resets variables
            stage = speed = 1;
            streamer = playsound = undefined;
        }
    }

    if (streamer !== undefined && playsound !== undefined)
        psJobs.push([streamer, playsound, speed]);
        
    generateCommentJob(item, sounds, psJobs);
}


let generateCommentJob = async (item, sounds, ps) => {
    let url = "",
        files = [];

    if (ps.length == 1) {
        ps = ps[0];
        if (ps[0] == "custom")
            url = customURL + ps[1];
        else
            url = sounds[ps[0]][ps[1]]["url"];
        replyComment(item, url, comment = ps[1]);
    }

    // download playsounds if multiple and combine
    else {
        while (ps.length > 0) {
            let tempPS = ps.shift(),
                dateTime = Date.now();

            let url = (tempPS[0] != "custom") ? sounds[tempPS[0]][tempPS[1]]["url"]:
                      customURL + sounds[tempPS[0]][tempPS[1]]["filename"],
                filename = url.split("/");
            filename = filename[filename.length - 1];
            console.log("downloading");
            await psHandler.download(url, tempPS[2], dateTime);
            console.log("download completed");
            files.push(psHandler.newFilename(filename, dateTime, genPath = true));
        }
    }
    combinePlaysounds(item, files);
}


let combinePlaysounds = (item, files) => {
    let start = Date.now(),
        allExists = false;

    let checkFiles = setInterval(async () => {
        if (!allExists) {
            let fileCount = 0;

            files.forEach((file) => {
                fileCount += fs.existsSync(file);
            });

            if (fileCount == files.length) {
                allExists = true;

                // combined filename of playsounds
                let filename = getCombinedFilename(files);
                await psHandler.combine(files, filename);
                replyComment(item, generatedURL + filename);
            }
        }
    }, 1000);
}

// returns combined filename of joint playsound
let getCombinedFilename = (files) => {
    let combinedFile = [];

    files.forEach((file) => {
        let f = file.split("/");
        f = f[f.length - 1].split("_ss_")[0];
        combinedFile.push(f);
    });

    return combinedFile.join("_") + "_ss_" + Date.now() + ".ogg";
}


let replyComment = (item, url, comment = "Your order") => {
    item.reply(`[${comment}](${url})`);
    etc.log("Comment", `Replied with "[${comment}](${url})"`);
}

let checkCommented = (item) => {
    let commented = false;
    return new Promise((res) => {
        item.expandReplies().then(c => {
            let replies = c.replies;
            // checks if bot has already commented.
            for (let i = 0; i < replies.length; i++) {
                let author = replies[i].author.name;
                if (author == creds["username"]) {
                        commented = true;
                        res(commented);
                }
            }
            // if hasn't commented, comments and returns false promise so program can continue
            res(commented);
        });
    });
};


let isFloat = (inputString) => {
    const parsed = parseFloat(inputString);

    //checks if length of input is same as output
    return !isNaN(parsed) && parsed.toString() === inputString;
}