# Xqedii Bots
[![Release](https://img.shields.io/badge/release-1.0-blue)](https://github.com/Xqedii/Xqedii-Bots-Panel) 
[![Release](https://img.shields.io/badge/Panel-Docs-yellow)](https://github.com/Xqedii/Xqedii-Bots-Panel/blob/main/DOCS.md) 
[![Discord](https://img.shields.io/badge/Discord-Join-7289DA?logo=discord&logoColor=white)](https://discord.com/invite/6JQfeQEB4W)

**Web Panel for security testing and server optimization**
Advanced panel for connecting bots to Minecraft servers using MCProtocolLib.
Bots can join servers from different proxy IPs and different Minecraft versions thanks to ViaProxy.

This panel must not be used for intentional actions that harm other servers!
It is intended solely for testing your own server, for example to test anti-bot and anti-crash protections.

-----

# Overview

The main panel contains 9 categories, a statistics section, and settings.
The first category allows you to select the server, number of bots, Minecraft version, the interval at which bots join, their nicknames, and the actions they should perform.

The Start button begins the server attack. Before the attack starts, if bots are set to join from different versions, Velocity or ViaProxy will be activated automatically, and the bots will be routed through them.

In the Quick Actions tab, you’ll find various options such as sending messages in chat using bots, dropping all items, moving the bots’ heads, and executing built-in commands like disabling gravity, moving bots, and more.

<img width="2009" height="910" alt="image" src="https://github.com/user-attachments/assets/d6c381b9-cb66-48e9-9421-d24833830273" />

-----

# Categories

The panel includes several categories that are useful for testing a server. Each category contains settings for bots that will be applied when they join. Below is a complete description of each category.

## Actions Manager
This category allows you to create actions that bots will perform upon joining the server. For example, if you want a bot to register, select slot 4 in the inventory, right-click, and then choose a slot in a GUI, you can use a simple script:

```csharp
[cmd /register XqBots!@3 XqBots!@3]
[wait 500]
[slot 4]
[wait 500]
[right]
[wait 100]
[gui 21]
```

> [!NOTE]
> Actions are written in a simple, custom language designed specifically for this panel. A description of the language, all possible bot actions, and example scripts can be found in the DOCS.md file.

## Nicknames Manager

In this section, you can add a list of nicknames that bots will use to join your server. You can either manually create a list with custom nicknames or generate one automatically. By default, if no nickname list is selected, bots will join with random nicknames consisting of letters and numbers.

## Proxy Manager

Bots can connect through SOCKS4 or SOCKS5 proxies. You can create a list containing `IP:PORT` or `USERNAME:PASSWORD:IP:PORT`, allowing your bots to join from different IP addresses for each connection.

## Captcha Settings

Here you can choose how you want captchas on maps to be solved. You can select:
 - Manual mode – the map is displayed in the panel, and you have to type the solution yourself.
 - Automatic mode – requires the OpenAI API.

## Ascii Art Manager

You can create pixel art that bots will send in chat. Each bot sends its own line at the right moment to create the desired visual effect.

## Listeners Manager

A very useful category that allows you to manage what bots do when they receive events from the server. For example, you can set it up so that when a bot receives a message containing /register and a code, it registers automatically:

```csharp
[CHAT listener]:
    [if {message} contains "/register"]:
        [cmd "/register XqBots!@3 XqBots!@3 {code}"]
```

Or, if you want something to happen when a captcha code appears on the map, you can automatically type the code in chat once it’s solved:

```csharp
[CAPTCHA listener]:
    [chat {code}]
```

> [!NOTE]
> A full description of all listeners, including available types and example scripts, can be found in `DOCS.md`

## Multi Actions Manager

This category is similar to Actions, but it allows you to execute commands sequentially rather than all at once, and to trigger actions via in-game chat messages. For example, to bypass chat delay, you can use a script like this:

```csharp
[chat "Send"]     # This message will be sent by bot 1
[chat "Messages"] # These by bots 2, etc.
[chat "quickly"]
[chat "and"]
[chat "bypass"]
[chat "chat"]
[chat "limits"]
[wait 1000]
[chat ":)"]
```
## Settings

The last category is Settings, where you can:
 - Switch the panel theme from light to dark
 - Enable or disable notifications for high CPU/RAM usage
 - Choose how the panel converts domains to `IP:port`
 - Configure AutoReconnect for bots

Additionally, in the Advanced Settings section, you can find ViaProxy settings. These can be useful when connecting through a proxy → lobby (e.g., 1.18.2) and then wanting to switch from that lobby to a game mode that requires a higher version, such as 1.21.4.

-----

# Installation

To launch the panel, simply clone the repository, install all dependencies with Node, and then run `node server.js`.
After the server is turned on, we can access the panel by going to https://localhost:3001

> [!IMPORTANT]
> For the panel to work properly, you need Node.js and Java 17+
