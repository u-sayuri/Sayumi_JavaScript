//Init
const FileSystem = require("fs");
const path = require("path");

const Discord = require("discord.js");
const Winston = require("winston");
const Database = require("mongoose");
const GlobalSettings = require("./DefaultGlobalSettings");
const { connect } = require("http2");

require("dotenv").config;
const {TOKEN, master, databaseUsername, databasePassword} = process.env;

//Paths
const URIString = `mongodb+srv://${databaseUsername}:${databasePassword}@main-ftdmd.azure.mongodb.net`; 

const client = new Discord.Client();
const cooldown = new Discord.Collection();
const MentionCooldown = new Discord.Collection();
client.commandsList = new Discord.Collection();
client.aliasesList = new Discord.Collection();
client.cagetories = new Discord.Collection();

//Date-time system
const now = Date.now();
const days = Math.floor(now / 86400000);
const hours = (Math.floor(now / 3600000) % 24) + 7;
const minutes = Math.floor(now / 60000) % 60;
const seconds = Math.floor(now / 1000) % 60;

let hrs = "";
    if (hours < 10) {
        hrs = `0${hours}`;
    } else {
        hrs = hours;
    }
let min = "";
    if (minutes < 10) {
        min = `0${minutes}`;
    } else {
        min = minutes;
    }
let sec = "";
    if (seconds < 10) {
        sec = `0${seconds}`;
    } else {
        sec = seconds;
    }

// Logger init 
const logger = Winston.createLogger({
    transports: [
      new Winston.transports.Console(),
      new Winston.transports.File({ filename: "./log.txt", json: false }),
    ],
    format: Winston.format.printf(
      log => `[${log.level.toUpperCase()}] - ${log.message} (${days} - ${hrs}:${min}:${sec}) <GMT +7>`),
  });

client.on("ready", () => {
    logger.log("info", "Status 200");
  });
  
  client.on("debug", m => logger.log("debug", m));
  client.on("warn", m => logger.log("warn", m));
  client.on("error", e => logger.log("error", e));
  
  process.on("uncaughtException", error => {
    logger.log("error", "Uncaught exception received.\n", error);
    console.error(error);
  });
  process.on("unhandledRejection", error => { 
    console.error("Uncaught Promise Rejection:\n", error.name + ": " + error.message + `\n- Details:\t`);
    console.error(error);
  });

// Database init
console.log("Connecting to database...")
Database.connect(`mongodb+srv://${databaseUsername}:${databasePassword}@main-ftdmd.azure.mongodb.net/sayumi/test/`, {
    useUnifiedTopology: true,
});

const Connection = Database.connection;
Connection.on('error', e => {
    console.error.bind(console, 'Connection ERR:')
    logger.log("error", e);
})

// Status message and misc.
client.once("ready", () => {
    const options = [
      "Log standby...",
      "Ready!",
      "On standby.\nAn activity will be set if you start a command.",
      "The log's ready.",
      "Connection established.",
    ];
    const ready = options[Math.floor(Math.random() * options.length)]; 
    console.log(ready);
    client.users.get(process.env.ownerID).send('Terminal online.');
    setInterval(() => {
      const statuses = [
        "raw event data", 
        "what is her prefix", 
        "how to become a reliable maid", 
        "Sayuri's diary", 
        `${client.users.size} users`, 
        "debug console",
        "terminal output",
      ];
    const Status = statuses[Math.floor(Math.random() * statuses.length)];
    client.user.setActivity(Status, { type: "WATCHING" }).then(presence => {
        console.log(
            "<Activity>",
            `Activity set to "${presence.game ? presence.game.name : "none"}".`
        );
      });
    }, 300000);
  });
  
client.once("reconnecting", () => {
    console.log("Reconnecting...");
});
client.once("disconnect", () => {
    console.log("Connection lost.");
});

// Load executables from command directory
const Root = "./";
const Commands = Root + "executables";
let FileCount = 0;
let ExecutableFileCount = 0;
let UnexecutableFileCount = 0;
let EmptyCommandFileCount = 0;

const CommandLoad = (dir) => {

    FileSystem.readdirSync(dir).forEach(file => {
        const Path = Root + path.join(dir, file)
        if (file === "settings.js") return;
        if (FileSystem.lstatSync(Path).isDirectory) {
            CommandLoad(Path);
        }
        else if (file.endsWith(".js")) {
            FileCount++;
            const Command = require(dir);
            if (!Command.issue || !Command.issue === {}) {
                EmptyCommandFileCount++;
            }
            if (Command.status === false) {
                UnexecutableFileCount++;
            } 
            else ExecutableFileCount++;
            client.commands.set(Command.name, Command);
            client.aliases.set(Command.aliases, Command.name);
        }
   });
};

CommandLoad(Commands);

if (FileCount <= 0) {
    console.log("[INFO] The directory is currently empty!")
} else {    
    console.log(`[INFO] Successfully loaded ${FileCount} commands`);
    if (UnexecutableFileCount > 0) { 
        console.log(`with ${UnexecutableFileCount} files disabled`);
    }
    if (EmptyCommandFileCount > 0) {
        console.log(`with ${EmptyCommandFileCount} files empty`);
    }
}


// Message events
client.on("message", async message => {
    let Guild = JSON.parse("./GuildList.json", "utf8");
    let Channel = JSON.parse("./ChannelStatus.json", "utf8");

    let prefix = GlobalSettings.defaultPrefix;
    let FalseCMDReply = GlobalSettings.defaultFalseCMDReply;
    let ReplyStatus = GlobalSettings.defaultReplyStatus;

    if (message.guild) {
        if (!Guild[message.guild.id]) {
            Guild[message.guild.id] = {
                prefix: GlobalSettings.defaultPrefix,
                welcomeChannel: false,
                greetingMessage: "",

            }
        }
        prefix = Guild[message.guild.id].prefix;
    }

    if (message.channel && message.channel.type !== "dm" && message.channel.type !== "voice") {
        if (!Channel[message.channel.id]) {
            Channel[message.channel.id] = {
                FalseCMDReply: GlobalSettings.defaultFalseCMDReply,
                AllowReply: GlobalSettings.defaultReplyStatus
            }
        }
        FalseCMDReply = Channel[message.channel.id].FalseCMDReply;
        ReplyStatus = Channel[message.channel.id].AllowReply;
    }
    
    if (message.guild) {
    if (!message.client.permissions.has("SEND_MESSAGES") || !message.client.permissions.has("READ_MESSAGE_HISTORY")) return;
    if (ReplyStatus === false) {
        if (!message.member.hasPermission("ADMINISTRATOR")) return;
    } 

    }
    const args = message.content.slice(prefix.length).split(/ +/);
    const CommandName = args.shift().toLowerCase();
    const command = client.commandsList.get(CommandName) || 
                    client.commandsList.find(cmd => cmd.aliases && cmd.aliases.includes(CommandName)
                    );
    const content = message.content.toLowerCase();

    // if (content.includes(prefix, 0) && content.includes(CommandName, 1)) {}

    // Mention respond (general)
    let MentionedMassage = false;
    if (!message.content.startsWith(prefix)) {
        if (message.author.bot) return;
        if (contents.startsWith(`<@${client.user.id}>`) && !message.author.bot) {
            if (message.author.id === master) {
                const reply = ["", "", "", "Not now.", "No."]
                const respond = reply[Math.floor(Math.random() * reply.length)];
                message.channel.send(respond);
                MentionedMassage = true;
            }
            else { 
                const reply = [
                `My prefix is \`${prefix}\``,
                `Type \`${prefix}help\` to see command index.`,
                `Am I a human?`
                ];
                const respond = reply[Math.floor(Math.random() * reply.length)];
                if (MentionedMassage === false) return message.channel.send(respond);
                if (MentionedMassage === true) return;
                MentionedMassage = true;
                logger.log(
                    message.author.tag + " tagged me.\n Contents: " + `"${message.content}"`
                );
            }
        }

        setTimeout(7000).then(MentionedMassage = false);
    
        if (!MentionCooldown.has("mention")) {
        MentionCooldown.set("mention", new Discord.Collection());    
        }  
        const MentionTimestamp = MentionCooldown.get("mention");
        const PausedTime = 5000;

        if (MentionTimestamp.has(message.author.id)) {
            const MentionExpirationTime = timestamps.get(message.author.id) + PausedTime;
        
            if (now < MentionExpirationTime && message.author.id !== process.env.master) {
              const timeLeft = (MentionExpirationTime - now) / 1000;
                if (ReplyStatus === true) return message.channel.send(
                `Wait ${timeLeft.toFixed(0)} more second${
                  timeLeft > 1 ? "s" : ""
                }...`
                ).then(message.delete(3000));
            } else;
          }
        MentionTimestamp.set(message.author.id, now);
        setTimeout(() => MentionTimestamp.delete(message.author.id), PausedTime);

    }

    console.log("<Terminal>", "A command has been executed.");

    if (!command) {
        const typo = message.content.slice(prefix.length);
        const NotACmd = [
            "This is not a vaild command for me.",
            `Perhaps a typo, ${message.author}?\n\`"${typo}"\``,
            "I can't issue this.",
            `What is *${typo}*?`,
            `If that is an unadded feature, consider typing \`${prefix}feedback ${typo}\` if you want this feature/command added to my collection.`,
        ];
        const respond1 = NotACmd[Math.floor(Math.random() * NotACmd.length)];
        
        console.log(
            "<Terminal>", 
            `Unknown command '${CommandName}'. command execution has been cancelled.`
        );
        if (FalseCMDReply === true && ReplyStatus === true) return message.channel.send(respond1);
    }

    console.log("command name: " + CommandName);
    const cmdArgs = message.content.slice(prefix.length + commandName.length + 2).split(/ +/);
    if (cmdArgs === "") {
        if (command.description === "") {
        console.log(
            "Command to issue: " +
            `/${commandName}: ` +
            "<no description> " +
            "(empty_string)"
        );
        } 
        if (!command.args) {
        if (command.description) {
            console.log(
            "Command to issue: " +
                `/${commandName}: ` +
                command.description
            );  
        } else {
            console.log(
                "Command to issue: " +
                `/${commandName}: ` +
                "<no description> "
            );
            }
        } else {
        console.log(
            "Command to issue: " +
            `/${commandName}: ` +
            command.description +
            "(empty_string)"
        );
        }
    } else {
        console.log("command to issue: " + `/${commandName}: ` + `'${cmdArgs}'`);
    }
    // const BlankCmd = [
    //     "Hmmmmmm..."
    // ];
    // const respond2 = BlankCmd[Math.floor(Math.random() * BlankCmd.length)];
    //     if (message.content === `${prefix}`) {
    //         if (ReplyStatus === true) return message.channel.send(respond2).then(m => m.delete(4000));
    //         else return;
    //     }

    // Command cooldowns
    if (!cooldown.has(Command.name)) {
        cooldown.set(Command.name, new Discord.Collection());
        }
    
        const timestamps = cooldown.get(Command.name);
        const cooldownAmount = (Command.cooldown || 3) * 1000;
    
        if (timestamps.has(message.author.id)) {
            const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
        
            if (now < expirationTime && message.author.id !== ownerID) {
                const timeLeft = (expirationTime - now) / 1000;
                return message.reply(
                    `please wait ${timeLeft.toFixed(0)} more second${
                    timeLeft > 1 ? "s" : ""
                    } before reusing the '${Command.name}' command.`
                );
            }
        }
    
    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    // Responses when executing guild commands inside DMs
    if (command.guildOnly && message.channel.type !== "text") {
        console.log(
          "<Terminal>",
          `User ${message.author} has sent a guild command in direct message.`
        );
        const NoDM = [
          "Unfortunately, this command cannot be executed inside DMs.",
          "Sorry, but i can't do this inside a direct-message chat.",
          "Make sure that you typed this command inside a server.",
        ];
        const respond = NoDM[Math.floor(Math.random() * NoDM.length)];
        return message.reply(respond);
    }

    // Master-only commands
    if (command.ownerOnly && message.author.id !== master) {
        message.channel.send(
          `Sorry ${message.author}, but this command can be issued by my master only.`
        );
        return;
      }
    
    // Empty args responses
    if (command.args && !args.length) {
        console.log("<Args>", "Starting arguments detection..."),
        console.log(
            "<Args#return>",
            `User ${message.author} didn't give any arguments. command cancelled.`
        );
        let string = command.prompt;
        if (string === false) {
           message.channel.send('Terminal standing by.').then(m => m.delete(4000));
           return;
        }
        if (string === undefined || string === null || string === "") {
            const NoArgs = [
            `There is no arguments.`,
            `Hey ${message.author}, I need an argument to work with.`,
            `You didn't provide any arguments, ${message.author}!`,
            "Hmmm...I don't see any arguments here.",
            ];
            string = NoArgs[Math.floor(Math.random() * NoArgs.length)];
            if (command.usage) {
                string += `\nUsage: \`${prefix}${command.name} ${command.usage}\`.`;
            } 
            if (ReplyStatus === true) return message.channel.send(string).then(m => m.delete(8000));
        }
        if (command.usage) {
            string += `\nUsage: \`${prefix}${command.name} ${command.usage}\`.`;
        }
        if (ReplyStatus === true) return message.reply(string).then(m => m.delete(6000));
      }

    // Execute commands and error responses
    try {
        console.log("[DEBUG] Running command: " + command.name);
        command.issue(message, args, client);
      } catch (error) {
        console.error(error);
        logger.log("error", error);
        console.log("<Error>", "Found " + error);
        const err = [
          `The command you're trying to issue is unavailable or being not issued due to some errors. Please try again later.`,
          `Oops, looks like I've encounter an error. Error is being reported, I'm trying to fix this as soon as possible.`,
        ];
        if (message.channel.type !== "dm" && message.channel.type !== "voice") {
          const channel = client.channels.get('630334027081056287');
          const embed = new Discord.RichEmbed()
            .setColor('#ff0000')
            .setTitle('An error has occured.')
            .setDescription(`*At ${message.channel} of server "${message.guild.name}"*\n*Issued by* - ${message.author.tag}:\n"${message.content}"`)
            .addField('Error status ------------------------------------------', `\`${error}\``)
            .setTimestamp();
            channel.send(embed);
        } else {
          const channel = client.channels.get('630334027081056287');
          const embed = new Discord.RichEmbed()
            .setColor('#ff0000')
            .setTitle('An error has occured.')
            .setDescription(`*Issued by* ${message.author}`)
            .addField('Error status ------------------------------------------', `\`${error}\``)
            .setTimestamp();
            channel.send(embed);
        }
        const respondErr = err[Math.floor(Math.random() * err.length)];
        if (message.channel.type === "dm") return message.channel.send(respondErr)
        else if (message.channel.type !== "dm") {
            message.channel.send(respondErr).then(message.delete(4500));
        }
        return;
      }
    
});

// Guild events
client.on("guildCreate", async (client, guild) => {
    Database.connect(URIString + "/sayumi/GuildList", {
        useNewURLParser: true,
        useUnifiedTopology: true,
    })
    const Guild = require("./databaseModels/guild");

    const NewGuild = new Guild({
        ItemID: Database.Types.ObjectId(),
        guildName:      guild.name,
        guildID:        guild.id,
        guildOwnerTag:  guild.owner.tag,
        guildOwnerID:   guild.owner.id,
        memberCount:    guild.member.size,
        prefix:         GlobalSettings.defaultPrefix,
        welcomeChannel: GlobalSettings.welcomeChannel,
        welcomeMessage: GlobalSettings.welcomeMessage,
        adminRoles:     GlobalSettings.AdminRoles,
        modRoles:       GlobalSettings.moderatorRoles,
        // 
        modStatus:      GlobalSettings.moderatorStatus,
        adminStatus:    GlobalSettings.Administrator,
    });

    NewGuild.save().then(res => console.log(res)).catch(console.error);
    logger.log("info", `I was added to ${guild.name}!`)
});

client.on("guildDelete", async guild => {   
    Database,connect(URIString + "/sayumi/GuildList", {
        useNewURLParser: true,
        useUnifiedTopology: true,
    });


});

// Login.
client.login(TOKEN).catch(console.error)