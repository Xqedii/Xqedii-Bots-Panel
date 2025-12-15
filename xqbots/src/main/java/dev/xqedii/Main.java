package dev.xqedii;

import com.github.steveice10.mc.protocol.data.status.ServerStatusInfo;
import com.github.steveice10.packetlib.ProxyInfo;
import org.apache.commons.cli.*;
import org.xbill.DNS.Lookup;
import org.xbill.DNS.Record;
import org.xbill.DNS.SRVRecord;
import org.xbill.DNS.Type;

import java.io.*;
import java.net.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Scanner;
import java.util.Timer;
import java.util.TimerTask;
import java.util.List;
import java.util.Arrays;


public class Main {

    public static boolean coloredChat = true;
    static ArrayList<Bot> bots = new ArrayList<>();
    private static int triedToConnect;
    private static int botCount;
    private static boolean isMainListenerMissing = true;
    private static final SecureRandom random = new SecureRandom();
    private static int delayMin = 4000;
    private static int delayMax = 5000;
    private static boolean minimal = false;
    private static boolean mostMinimal = false;
    private static volatile boolean isAutoSwapRunning = false;

    public static int autoReconnectDelay = 0; // Domyślnie 0 = wyłączone
    private static boolean useProxies = false;
    private static final ArrayList<ProxyDetails> proxies = new ArrayList<>();
    private static int proxyIndex = 0;
    private static int proxyCount = 0;
    private static ProxyInfo.Type proxyType;

    public static String captchaMode = "manual"; // Domyślnie
    public static List<MultiAction> loadedMultiActions = new ArrayList<>();
    public static List<String> activeListenerFiles = new ArrayList<>();
    private static Timer timer = new Timer();
    private static ListenerManager listenerManager = null;

    private static volatile boolean isAsciiSequenceRunning = false;
    private static final List<String> DEFAULT_ASCII_MESSAGES = Arrays.asList(
            "a", "s", "c", "i", "i"
    );

    private static class ProxyDetails {
        final String host;
        final int port;
        final String username;
        final String password;

        public ProxyDetails(String host, int port, String username, String password) {
            this.host = host;
            this.port = port;
            this.username = username;
            this.password = password;
        }
    }


    public static void main(String[] args) throws Exception {

        Options options = new Options();

        options.addOption("c", "count", true, "bot count");

        Option addressOption = new Option("s", "server", true, "server IP[:port]");
        addressOption.setRequired(true);
        options.addOption(addressOption);

        Option delayOption = new Option("d", "delay", true, "connection delay (ms) <min> <max>");
        delayOption.setArgs(2);
        options.addOption(delayOption);

        options.addOption("l", "proxy-list", true, "Path or URL to proxy list file with user:pass@host:port on every line");

        options.addOption("t", "proxy-type", true, "Proxy type: SOCKS4 or SOCKS5");
        options.addOption(null, "socks5", true, "Path to SOCKS5 proxy list");
        options.addOption(null, "socks4", true, "Path to SOCKS4 proxy list");
        options.addOption(null, "captcha-mode", true, "Captcha mode: manual or api");

        options.addOption(null, "nicks", true, "Path to nicks file with nick on every line");
        options.addOption(null, "nick-base", true, "Base name for sequential nicks (e.g., MyBot)");

        options.addOption("a", "actions", true, "Path to actions script file");
        options.addOption("r", "autoreconnect", true, "Auto reconnect delay (ms)");
        options.addOption(null, "listeners", true, "Path to listeners folder");

        // NOWE OPCJE
        options.addOption(null, "active-listeners", true, "Comma separated list of active listener files");
        options.addOption(null, "active-multi-actions", true, "Special string for multi actions");

        CommandLineParser parser = new DefaultParser();
        CommandLine cmd = null;

        try {
            cmd = parser.parse(options, args);
        } catch (ParseException e) {
            System.out.println(e.getMessage());
            new HelpFormatter().printHelp("bot-utility", options);
            System.exit(1);
        }

        // Parsing Active Listeners
        if (cmd.hasOption("active-listeners")) {
            String raw = cmd.getOptionValue("active-listeners");
            activeListenerFiles = Arrays.asList(raw.split(","));
            Log.info("Active Listeners: " + activeListenerFiles);
        }
        if (cmd.hasOption("captcha-mode")) {
            captchaMode = cmd.getOptionValue("captcha-mode");
            Log.info("Captcha mode set to: " + captchaMode);
        }
        // Parsing Multi Actions
        if (cmd.hasOption("active-multi-actions")) {
            String raw = cmd.getOptionValue("active-multi-actions");
            String[] entries = raw.split(";;;");

            for (String entry : entries) {
                String[] parts = entry.split("\\|");
                if (parts.length >= 2) {
                    String path = parts[0];
                    String trigger = parts[1];
                    try {
                        List<String> lines = Files.readAllLines(Paths.get(path));
                        loadedMultiActions.add(new MultiAction(trigger, lines));
                        Log.info("Loaded MultiAction Trigger: '" + trigger + "' (" + lines.size() + " lines)");
                    } catch (IOException e) {
                        Log.error("Failed to load MultiAction file: " + path);
                    }
                }
            }
        }

        if (cmd.hasOption("nicks") && cmd.hasOption("nick-base")) {
            Log.error("Error: --nicks and --nick-base cannot be used at the same time. Please choose one.");
            new HelpFormatter().printHelp("bot-utility", options);
            System.exit(1);
        }
        if (cmd.hasOption("r")) {
            try {
                autoReconnectDelay = Integer.parseInt(cmd.getOptionValue("r"));
                Log.info("Auto Reconnect enabled: " + autoReconnectDelay + " ms");
            } catch (NumberFormatException e) {
                Log.error("Invalid auto reconnect delay.");
                System.exit(1);
            }
        }
        if (cmd.hasOption("listeners")) {
            String listenersPath = cmd.getOptionValue("listeners");
            Log.info("Initializing listeners from folder: " + listenersPath);
            listenerManager = new ListenerManager(listenersPath);
        }

        // (Reszta obsługi proxy - bez zmian)
        if (cmd.hasOption('l') || cmd.hasOption("socks5") || cmd.hasOption("socks4")) {
            // ... (twój dotychczasowy kod obsługi proxy) ...
            // Skróciłem tu dla czytelności, wklej tu swój kod proxy
            String proxyPath = null;
            if (cmd.hasOption("socks5")) {
                proxyType = ProxyInfo.Type.SOCKS5;
                proxyPath = cmd.getOptionValue("socks5");
            } else if (cmd.hasOption("socks4")) {
                proxyType = ProxyInfo.Type.SOCKS4;
                proxyPath = cmd.getOptionValue("socks4");
            } else {
                String typeStr = cmd.getOptionValue('t');
                if (typeStr != null) {
                    try {
                        proxyType = ProxyInfo.Type.valueOf(typeStr.toUpperCase());
                    } catch (IllegalArgumentException e) {
                        Log.error("Invalid proxy type, use SOCKS4 or SOCKS5.");
                        System.exit(1);
                    }
                }
            }
            if (proxyPath == null && cmd.hasOption('l')) {
                proxyPath = cmd.getOptionValue("l");
            }
            if (proxyPath != null && proxyType != null) {
                try {
                    ArrayList<String> lines = new ArrayList<>();
                    try {
                        URL url = new URL(proxyPath);
                        try (BufferedReader reader = new BufferedReader(new InputStreamReader(url.openStream()))) {
                            String line;
                            while ((line = reader.readLine()) != null) lines.add(line);
                        }
                    } catch (MalformedURLException e) {
                        try (Scanner scanner = new Scanner(new File(proxyPath))) {
                            while (scanner.hasNextLine()) lines.add(scanner.nextLine());
                        }
                    }
                    for (String line : lines) {
                        if (line.trim().isEmpty() || line.startsWith("#")) continue;
                        try {
                            String host = null;
                            int port = -1;
                            String username = "";
                            String password = "";
                            String cleanLine = line.trim();
                            if (cleanLine.contains("@")) {
                                String[] authAndHost = cleanLine.split("@");
                                if (authAndHost.length == 2) {
                                    String[] userAndPass = authAndHost[0].split(":", 2);
                                    String[] hostAndPort = authAndHost[1].split(":", 2);
                                    if (userAndPass.length == 2 && hostAndPort.length == 2) {
                                        username = userAndPass[0];
                                        password = userAndPass[1];
                                        host = hostAndPort[0];
                                        port = Integer.parseInt(hostAndPort[1]);
                                    }
                                }
                            }
                            else {
                                String[] parts = cleanLine.split(":");
                                if (parts.length == 2) {
                                    host = parts[0];
                                    port = Integer.parseInt(parts[1]);
                                }
                                else if (parts.length == 4) {
                                    host = parts[0];
                                    port = Integer.parseInt(parts[1]);
                                    username = parts[2];
                                    password = parts[3];
                                }
                            }
                            if (host != null && port != -1) {
                                proxies.add(new ProxyDetails(host, port, username, password));
                                proxyCount++;
                            }
                        } catch (Exception ex) {}
                    }
                } catch (IOException e) {
                    Log.error("Could not read proxy list from: " + proxyPath);
                    System.exit(1);
                }
                if (proxyCount > 0) {
                    useProxies = true;
                    Log.info("Loaded " + proxyCount + " valid proxies (" + proxyType + ").");
                } else {
                    Log.error("No valid proxies loaded from the list.");
                    System.exit(1);
                }
            }
        }

        String actionsFilePath = cmd.getOptionValue("a");
        if (actionsFilePath != null) {
            Log.info("Using actions script from: " + actionsFilePath);
        }

        botCount = Integer.parseInt(cmd.getOptionValue('c', "1"));

        if (cmd.hasOption('d')) {
            String[] delays = cmd.getOptionValues('d');
            delayMin = Integer.parseInt(delays[0]);
            delayMax = delayMin + 1;
            if (delays.length == 2) {
                delayMax = Integer.parseInt(delays[1]);
            }
            if (delayMax <= delayMin) {
                throw new IllegalArgumentException("delay max must not be equal or lower than delay min");
            }
        }

        String address = cmd.getOptionValue('s');

        int port = 25565;
        if (address.contains(":")) {
            String[] split = address.split(":", 2);
            address = split[0];
            port = Integer.parseInt(split[1]);
        } else {
            try {
                Record[] records = new Lookup("_minecraft._tcp." + address, Type.SRV).run();
                if (records != null && records.length > 0) {
                    SRVRecord srv = (SRVRecord) records[0];
                    address = srv.getTarget().toString().replaceFirst("\\.$", "");
                    port = srv.getPort();
                }
            } catch (Exception e) {
                Log.warn("SRV record lookup failed for " + address);
            }
        }

        NickGenerator nickGen = new NickGenerator();

        if (cmd.hasOption("nick-base")) {
            String nickBase = cmd.getOptionValue("nick-base");
            Log.info("Using sequential nicknames with base: " + nickBase);
            nickGen.setNickBase(nickBase);
        } else if (cmd.hasOption("nicks")) {
            Log.info("Loading nicknames from specified file...");
            int nicksCount = nickGen.loadFromFile(cmd.getOptionValue("nicks"));

            if (nicksCount == 0) {
                Log.error("No valid nicknames loaded.");
                System.exit(1);
            }
        }

        InetSocketAddress inetAddr = new InetSocketAddress(address, port);

        Log.info("IP:", inetAddr.getHostString());
        Log.info("Port: " + inetAddr.getPort());
        Log.info("Bot count: " + botCount);

        ServerInfo serverInfo = new ServerInfo(inetAddr);
        serverInfo.requestInfo();
        if (serverInfo.getStatusInfo() != null) {
            ServerStatusInfo statusInfo = serverInfo.getStatusInfo();
            Log.info(
                    "Server version: "
                            + statusInfo.getVersionInfo().getVersionName()
                            + " (" + statusInfo.getVersionInfo().getProtocolVersion()
                            + ")"
            );
        }
        Log.info();

        new Thread(() -> {
            for (int i = 0; i < botCount; i++) {
                try {
                    ProxyInfo proxyInfo = null;
                    if (useProxies) {
                        ProxyDetails details = proxies.get(proxyIndex);
                        proxyInfo = new ProxyInfo(
                                proxyType,
                                new InetSocketAddress(details.host, details.port),
                                details.username,
                                details.password
                        );
                        if (proxyIndex < (proxyCount - 1)) proxyIndex++; else proxyIndex = 0;
                    }

                    Bot bot = new Bot(
                            i + 1,
                            nickGen.nextNick(),
                            inetAddr,
                            proxyInfo,
                            actionsFilePath,
                            listenerManager
                    );
                    bot.start();

                    if (!mostMinimal) bots.add(bot);
                    triedToConnect++;

                    if (isMainListenerMissing && !isMinimal()) {
                        isMainListenerMissing = false;
                        bot.registerMainListener();
                    }

                    if (i < botCount - 1) {
                        long delay = getRandomDelay();
                        Log.info("Waiting", delay + "", "ms");
                        Thread.sleep(delay);
                    }

                } catch (Exception e) { e.printStackTrace(); }
            }
        }).start();

        Scanner scanner = new Scanner(System.in);

        while (scanner.hasNextLine()) {
            String line = scanner.nextLine();
            if (line.isEmpty()) continue;

            if (line.startsWith("!")) {
                handleCommand(line.substring(1));
            } else {
                Log.info("Sending chat message from all bots: " + line);
                bots.forEach(bot -> bot.sendChat(line));
            }
            Thread.sleep(50);
        }
    }

    public static synchronized void executeMultiAction(MultiAction action) {
        new Thread(() -> {
            Log.imp("Executing MultiAction for trigger: " + action.getTrigger());

            int currentBotIndex = 0;

            for (String line : action.getLines()) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;

                // POPRAWIONA SEKCJA OBSŁUGI WAIT / DELAY
                if (line.startsWith("[wait") || line.startsWith("[delay")) {
                    try {
                        // Pobiera wszystko między pierwszą spacją a ostatnim nawiasem ]
                        // Działa dla [wait 1000] i [delay 1000]
                        int spaceIndex = line.indexOf(" ");
                        int bracketIndex = line.lastIndexOf("]");

                        if (spaceIndex != -1 && bracketIndex != -1) {
                            String val = line.substring(spaceIndex + 1, bracketIndex).trim();
                            Thread.sleep(Long.parseLong(val));
                        }
                    } catch (Exception e) {
                        Log.warn("Invalid wait syntax in MultiAction: " + line);
                    }
                    continue; // Przechodzimy do następnej linii po odczekaniu
                }

                if (line.startsWith("[send") || line.startsWith("[chat")) {
                    try {
                        String msg = line.substring(line.indexOf("\"") + 1, line.lastIndexOf("\""));

                        synchronized (Main.class) {
                            if (bots.isEmpty()) break;

                            // Wybierz bota (Round Robin)
                            if (currentBotIndex >= bots.size()) currentBotIndex = 0;
                            Bot sender = bots.get(currentBotIndex);

                            sender.sendChat(msg);
                            currentBotIndex++;
                        }
                        // Małe opóźnienie techniczne między wysłaniem wiadomości (nie mylić z [wait])
                        Thread.sleep(50);
                    } catch(Exception e){
                        Log.error("Error executing line: " + line);
                    }
                }
            }
        }).start();
    }
    public static void reconnectBot(Bot oldBot) {
        if (autoReconnectDelay <= 0) return;

        Log.info("Scheduling reconnect for " + oldBot.getNickname() + " in " + autoReconnectDelay + "ms...");

        new Timer().schedule(new TimerTask() {
            @Override
            public void run() {
                try {
                    Bot newBot = new Bot(
                            oldBot.getBotId(),
                            oldBot.getNickname(),
                            oldBot.getAddress(),
                            oldBot.getProxy(),
                            oldBot.getActionsFilePath(),
                            oldBot.getListenerManager()
                    );
                    newBot.start();

                    synchronized (Main.class) {
                        bots.add(newBot);
                        // Jeśli włączony był headroll albo swap dla wszystkich, można to tu przywrócić
                        if (isAutoSwapRunning) newBot.startSectorSwapping();
                    }
                } catch (Exception e) {
                    Log.error("Failed to reconnect bot " + oldBot.getNickname());
                    e.printStackTrace();
                }
            }
        }, autoReconnectDelay);
    }
    private static void handleCommand(String commandLine) {
        String[] parts = commandLine.trim().split(" ", 2);
        String command = parts[0].toLowerCase();

        switch (command) {
            case "help":
                Log.info("");
                Log.info("!help - Displays this menu");
                Log.info("!crash - Start server crashing");
                Log.info("!dropall - Drop all items");
                Log.info("!headroll on/off - Start headroll");
                Log.info("!channel [number] - Change channel");
                Log.info("!list - List of all connected bots");
                Log.info("!ascii [file_path] - Send a sequence of messages from a file (or default)");
                Log.info("!bot [id] [command] - Execute command for bot");
                Log.info("[text] - Send chat message/command");
                Log.info("");
                break;
            case "swap":
                if (isAutoSwapRunning) {
                    Log.info("Stopping automatic sector swapping for all bots...");
                    bots.forEach(Bot::stopSectorSwapping);
                    isAutoSwapRunning = false;
                } else {
                    Log.info("Starting automatic sector swapping for all bots (1-5, 20s interval)...");
                    bots.forEach(Bot::startSectorSwapping);
                    isAutoSwapRunning = true;
                }
                break;
            // W pliku Main.java, wewnątrz metody handleCommand

            case "slot": {
                if (parts.length < 2) {
                    Log.warn("Usage: !slot <0-8>");
                    break;
                }

                try {
                    int slot = Integer.parseInt(parts[1]);

                    if (slot < 0 || slot > 8) {
                        Log.warn("Invalid slot number! Use 0-8.");
                        break;
                    }

                    Log.info("Changing hotbar slot to " + slot + " for all bots...");
                    bots.forEach(bot -> bot.selectHotbarSlot(slot));

                } catch (NumberFormatException e) {
                    Log.warn("Invalid number format: " + parts[1]);
                }
                break;
            }
            case "shoot": {
                if (parts.length < 2) {
                    Log.warn("Usage: !shoot on/off");
                    break;
                }

                String option = parts[1].toLowerCase().trim();

                if (option.equals("on")) {
                    Log.info("Enabling auto-shooting for all bots...");
                    bots.forEach(Bot::startShooting);
                } else if (option.equals("off")) {
                    Log.info("Disabling auto-shooting for all bots...");
                    bots.forEach(Bot::stopShooting);
                } else {
                    Log.warn("Unknown option: " + option);
                }
                break;
            }
            case "ascii":
                List<String> messagesToUse;
                if (parts.length > 1) {
                    String filePath = parts[1];
                    messagesToUse = loadMessagesFromFile(filePath);
                } else {
                    Log.info("No file path provided, using default ASCII messages.");
                    messagesToUse = DEFAULT_ASCII_MESSAGES;
                }

                if (messagesToUse != null && !messagesToUse.isEmpty()) {
                    triggerAsciiSequence(messagesToUse);
                }
                break;

            case "crash": {
                Log.info("Executing 'startSendingPackets' for all " + bots.size() + " bots...");
                bots.forEach(Bot::startSendingPackets);
                break;
            }
            case "right":
                Log.info("Executing right click for all bots...");
                bots.forEach(Bot::rightClickWithItem);
                break;

            case "gui":
                if (parts.length < 2) {
                    Log.warn("Usage: !gui <slot>");
                    break;
                }
                try {
                    int slot = Integer.parseInt(parts[1]);
                    Log.info("Clicking GUI slot " + slot + " for all bots...");
                    bots.forEach(bot -> bot.clickSlotInAllContainers(slot));
                } catch (NumberFormatException e) {
                    Log.warn("Invalid slot number.");
                }
                break;
            case "dropall": {
                Log.info("Executing 'dropHotbarItems' for all " + bots.size() + " bots...");
                bots.forEach(Bot::dropHotbarItems);
                break;
            }
            case "goto": {
                if (parts.length < 2) {
                    Log.warn("Usage: !goto <x> <y> <z>");
                    break;
                }

                String[] coords = parts[1].trim().split(" ");
                if (coords.length < 3) {
                    Log.warn("Usage: !goto <x> <y> <z>");
                    break;
                }

                try {
                    double x = Double.parseDouble(coords[0]);
                    double y = Double.parseDouble(coords[1]);
                    double z = Double.parseDouble(coords[2]);

                    Log.info("Moving all bots to X:" + x + " Y:" + y + " Z:" + z);

                    bots.forEach(bot -> bot.moveSmoothlyTo(x, y, z));

                } catch (NumberFormatException e) {
                    Log.warn("Invalid coordinate format. Use numbers (e.g., !goto 100 64 200).");
                }
                break;
            }
            case "gravity": {
                if (parts.length < 2) {
                    Log.warn("Uzycie: !gravity <on/off>");
                    break;
                }

                String mode = parts[1].toLowerCase().trim();

                if (!mode.equals("on") && !mode.equals("off")) {
                    Log.warn("Nieznany tryb. Uzyj 'on' lub 'off'.");
                    break;
                }

                Log.info("Ustawianie grawitacji na " + mode + " dla wszystkich botow...");

                // Wykorzystujemy istniejącą w Bot.java metodę processCommand,
                // która posiada już logikę bezpiecznego wyłączania/włączania fizyki
                bots.forEach(bot -> {
                    try {
                        bot.processCommand("[gravity " + mode + "]");
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                });
                break;
            }
            case "ch":
            case "channel":
            case "sector": {

                if (isAutoSwapRunning) {
                    Log.info("Manual sector change detected. Stopping automatic switching...");
                    bots.forEach(Bot::stopSectorSwapping);
                    isAutoSwapRunning = false;
                }

                String[] sectorParts = commandLine.trim().split(" ");
                if (sectorParts.length < 2) {
                    Log.warn("Usage: !sector <number | distribute <N>>");
                    Log.warn("Examples: !sector 5 | !sector distribute 8");
                    break;
                }

                String commandType = sectorParts[1].toLowerCase();

                if (commandType.equals("auto")) {
                    if (sectorParts.length < 3) {
                        Log.warn("Usage: !sector auto <number_of_sectors>");
                        break;
                    }
                    try {
                        int totalSectors = Integer.parseInt(sectorParts[2]);
                        if (totalSectors <= 0) {
                            Log.error("Number of sectors must be a positive number.");
                            break;
                        }

                        int botCount = bots.size();
                        if (botCount == 0) {
                            Log.warn("No bots connected to distribute.");
                            break;
                        }

                        Log.info("Distributing " + botCount + " bots evenly across " + totalSectors + " sectors...");

                        for (int i = 0; i < botCount; i++) {
                            Bot currentBot = bots.get(i);
                            int targetSector = (i % totalSectors) + 1;

                            Log.info("Bot #" + currentBot.getBotId() + " (" + currentBot.getNickname() + ") -> Sector " + targetSector);
                            currentBot.changeSector(targetSector, "sector", 0);
                        }

                    } catch (NumberFormatException e) {
                        Log.error("Invalid number of sectors: '" + sectorParts[2] + "'");
                    }
                } else {
                    try {
                        int sectorNumber = Integer.parseInt(commandType);
                        Log.info("Connecting all bots to sector #" + sectorNumber);
                        bots.forEach(bot -> bot.changeSector(sectorNumber, "sector", 0));
                    } catch (NumberFormatException e) {
                        Log.warn("Invalid command. Usage: !sector <number|auto<N>|distribute <N>>");
                    }
                }
                break;
            }
            case "headroll": {
                String[] headrollParts = commandLine.trim().split(" ");
                if (headrollParts.length < 2) {
                    Log.warn("Usage: !headroll on/off");
                    break;
                }
                String option = headrollParts[1].toLowerCase();
                switch (option) {
                    case "on":
                        Log.info("Enabling headroll for all bots...");
                        bots.forEach(Bot::startHeadroll);
                        break;
                    case "off":
                        Log.info("Disabling headroll for all bots...");
                        bots.forEach(Bot::stopHeadroll);
                        break;
                    default:
                        Log.warn("Unknown headroll option: " + option);
                }
                break;
            }
            case "list": {
                Log.info("Listing all connected bots (" + bots.size() + " total):");
                for (int i = 0; i < bots.size(); i++) {
                    Bot bot = bots.get(i);
                    Log.info("  [" + (i + 1) + "] " + bot.getNickname());
                }
                break;
            }
            case "bot": {
                String[] botParts = commandLine.trim().split(" ");
                if (botParts.length < 3) {
                    Log.warn("Usage: !bot <ID> <command>");
                    Log.warn("Available sub-commands: start, drop, headroll on/off");
                    return;
                }

                int botId;
                try {
                    botId = Integer.parseInt(botParts[1]);
                } catch (NumberFormatException e) {
                    Log.error("Invalid bot ID: '" + botParts[1] + "'. Must be a number.");
                    return;
                }

                int botIndex = botId - 1;

                if (botIndex < 0 || botIndex >= bots.size()) {
                    Log.error("Bot ID out of bounds. Valid IDs are from 1 to " + bots.size());
                    return;
                }

                Bot targetBot = bots.get(botIndex);
                String subCommand = botParts[2].toLowerCase();

                Log.info("Executing '" + subCommand + "' for bot " + botId + " (" + targetBot.getNickname() + ")");

                switch (subCommand) {
                    case "crash":
                        targetBot.startSendingPackets();
                        break;
                    case "drop":
                        targetBot.dropHotbarItems();
                        break;

                    case "shoot":
                        if (botParts.length < 4) {
                            Log.warn("Usage: !bot <ID> shoot on/off");
                            break;
                        }
                        String shootOption = botParts[3].toLowerCase();
                        if (shootOption.equals("on")) {
                            targetBot.startShooting();
                            Log.info("Shooting enabled for bot " + targetBot.getNickname());
                        } else if (shootOption.equals("off")) {
                            targetBot.stopShooting();
                            Log.info("Shooting disabled for bot " + targetBot.getNickname());
                        }
                        break;
                    case "slot":
                        if (botParts.length < 4) {
                            Log.warn("Usage: !bot <ID> slot <0-8>");
                            break;
                        }
                        try {
                            int slot = Integer.parseInt(botParts[3]);
                            targetBot.selectHotbarSlot(slot);
                            Log.info("Bot " + targetBot.getNickname() + " selected slot " + slot);
                        } catch (NumberFormatException e) {
                            Log.warn("Invalid slot number.");
                        }
                        break;
                    case "headroll":
                        if (botParts.length < 4) {
                            Log.warn("Usage: !bot <ID> headroll on/off");
                            break;
                        }
                        String headrollOption = botParts[3].toLowerCase();
                        switch (headrollOption) {
                            case "on":
                                targetBot.startHeadroll();
                                break;
                            case "off":
                                targetBot.stopHeadroll();
                                break;
                            default:
                                Log.warn("Unknown headroll option: '" + headrollOption + "'");
                                break;
                        }
                        break;
                    default:
                        Log.warn("Unknown sub-command for !bot: '" + subCommand + "'");
                        break;
                }
                break;
            }
            default:
                Log.warn("Unknown command: '" + command + "'");
                break;
        }
    }

    public static synchronized void setAutoSwapState(boolean isRunning) {
        isAutoSwapRunning = isRunning;
    }
    public static List<String> loadMessagesFromFile(String filePath) {
        try {
            Log.info("Loading ASCII messages from file: " + filePath);
            List<String> lines = Files.readAllLines(Paths.get(filePath));
            if (lines.isEmpty()) {
                Log.error("ASCII file is empty: " + filePath);
                return null;
            }
            return lines;
        } catch (IOException e) {
            Log.error("Could not read ASCII file: " + filePath + ". Error: " + e.getMessage());
            return null;
        }
    }

    public static synchronized void triggerAsciiSequence(List<String> messages) {
        if (isAsciiSequenceRunning) {
            Log.info("ASCII sequence is already running. Ignoring request.");
            return;
        }
        if (messages == null || messages.isEmpty()) {
            Log.error("Cannot start ASCII sequence with no messages.");
            return;
        }
        isAsciiSequenceRunning = true;

        new Thread(() -> {
            Log.info("Starting ASCII sequence...");
            try {
                ArrayList<Bot> botsSnapshot = new ArrayList<>(bots);
                int groupSize = messages.size();

                for (int i = 0; i < botsSnapshot.size(); i++) {
                    Bot currentBot = botsSnapshot.get(i);
                    String message = messages.get(i % groupSize);
                    currentBot.sendChat(message);
                    Thread.sleep(20);
                }
                Log.info("ASCII sequence finished.");
            } catch (InterruptedException e) {
                Log.warn("ASCII sequence was interrupted.");
                Thread.currentThread().interrupt();
            } finally {
                isAsciiSequenceRunning = false;
            }
        }).start();
    }


    public static synchronized void renewMainListener() {
        if (bots.isEmpty()) return;
        bots.get(0).registerMainListener();
    }

    public static synchronized void removeBot(Bot bot) {
        bots.remove(bot);
        if (bot.hasMainListener()) {
            Log.info("Bot with MainListener removed");
            isMainListenerMissing = true;
        }

        // --- ZMIANA: Nie wyłączamy programu, jeśli autoreconnect jest włączony ---
        if (bots.size() > 0) {
            if (isMainListenerMissing && !isMinimal()) {
                Log.info("Renewing MainListener");
                renewMainListener();
                isMainListenerMissing = false;
            }
        } else {
            // Wyłączamy tylko jeśli autoreconnect jest WYŁĄCZONY
            if (autoReconnectDelay <= 0 && triedToConnect == botCount) {
                Log.error("All bots disconnected, exiting");
                System.exit(0);
            } else {
                Log.info("All bots disconnected, waiting for autoreconnect...");
            }
        }
    }

    public static long getRandomDelay() {
        return random.nextInt(delayMax - delayMin) + delayMin;
    }

    public static boolean isMinimal() {
        return minimal;
    }
}