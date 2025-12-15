package dev.xqedii;

import com.github.steveice10.mc.protocol.packet.ingame.clientbound.ClientboundChatPacket;
import com.github.steveice10.mc.protocol.packet.ingame.clientbound.title.ClientboundSetActionBarTextPacket;
import com.github.steveice10.packetlib.Session;
import com.github.steveice10.packetlib.event.session.*;
import com.github.steveice10.packetlib.packet.Packet;
import net.kyori.adventure.text.Component;

public class MainListener implements SessionListener {

    private String lastLoggedMessage = "";

    public MainListener(String nickname) {
        Log.info("MainListener registered for: " + nickname);
    }

    @Override
    public void packetReceived(Session session, Packet packet) {
        Component message = null;
        String packetType = "";

        if (packet instanceof ClientboundChatPacket) {
            message = ((ClientboundChatPacket) packet).getMessage();
            packetType = "ChatPacket";
        }
        else if (packet instanceof ClientboundSetActionBarTextPacket) {
            message = ((ClientboundSetActionBarTextPacket) packet).getText();
            packetType = "ActionBarPacket";
        }

        if (message != null) {
            try {
                String textForCheck = Utils.getFullText(message, false);

                String textToLog = Utils.getFullText(message, Main.coloredChat);

                if (!textToLog.isEmpty()) {
                    if (!textToLog.equals(lastLoggedMessage)) {
                        Log.chat(textToLog);
                        lastLoggedMessage = textToLog;
                    }

                    for (MultiAction action : Main.loadedMultiActions) {
                        if (textForCheck.contains(action.getTrigger())) {
                            Log.info("[DEBUG] !!! TRIGGER DETECTED: " + action.getTrigger());
                            Main.executeMultiAction(action);
                        }
                    }
                }
            } catch (Exception e) {
                Log.error("Error processing packet " + packetType + ": " + e.getMessage());
                e.printStackTrace();
            }
        }
    }

    @Override
    public void packetSending(PacketSendingEvent event) { }

    @Override
    public void packetSent(Session session, Packet packet) { }

    @Override
    public void packetError(PacketErrorEvent event) { }

    @Override
    public void connected(ConnectedEvent event) { }

    @Override
    public void disconnecting(DisconnectingEvent event) { }

    @Override
    public void disconnected(DisconnectedEvent event) { }
}