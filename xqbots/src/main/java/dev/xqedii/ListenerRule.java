package dev.xqedii;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ListenerRule {

    private final String condition;
    private final List<String> actions;

    // Pattern obsługuje fragmenty warunku: {zmienna} operator "wartosc"
    private static final Pattern CONDITION_PATTERN = Pattern.compile("(\\{\\w+})\\s+(contains|is|notcontains|isnot)\\s+\"([^\"]*)\"", Pattern.CASE_INSENSITIVE);

    public ListenerRule(String condition) {
        // --- POPRAWKA: Sprawdzamy, czy condition nie jest nullem przed użyciem toLowerCase() ---
        if (condition != null && condition.toLowerCase().startsWith("if ")) {
            this.condition = condition.substring(3).trim();
        } else {
            this.condition = condition;
        }
        // ---------------------------------------------------------------------------------------
        this.actions = new ArrayList<>();
    }

    public void addAction(String action) {
        this.actions.add(action);
    }

    public List<String> getActions() {
        return actions;
    }

    public boolean isConditionMet(Bot bot, String message, PlayerInfo playerInfo) {
        // Jeśli warunek jest pusty (null), oznacza to regułę ogólną (bez [if]),
        // która wykonuje się dla wiadomości systemowych (nie od graczy).
        if (condition == null || condition.isEmpty()) {
            return !playerInfo.isPlayerMsg();
        }

        // --- OBSŁUGA OPERATORA && (AND) ---
        if (condition.contains("&&")) {
            String[] parts = condition.split("&&");
            for (String part : parts) {
                // Tworzymy tymczasową regułę dla każdego kawałka i sprawdzamy
                ListenerRule subRule = new ListenerRule(part.trim());
                if (!subRule.isConditionMet(bot, message, playerInfo)) {
                    return false; // Jeśli choć jeden warunek nie pasuje -> Fałsz
                }
            }
            return true; // Wszystkie pasują
        }
        // ----------------------------------

        Matcher matcher = CONDITION_PATTERN.matcher(condition);
        if (!matcher.find()) {
            return false;
        }

        String placeholder = matcher.group(1).toLowerCase();
        String operator = matcher.group(2).toLowerCase();
        String value = matcher.group(3);

        String textToCompare = "";

        switch (placeholder) {
            case "{message}":
                textToCompare = message;
                break;
            case "{player}":
                if (!playerInfo.isPlayerMsg()) return false;
                textToCompare = playerInfo.getPlayerName();
                break;
            case "{playermsg}":
                if (!playerInfo.isPlayerMsg()) return false;
                textToCompare = playerInfo.getPlayerMessage();
                break;

            // --- RZUTUJEMY NA INT ---
            case "{x}":
                textToCompare = String.valueOf((int) bot.getX());
                break;
            case "{y}":
                textToCompare = String.valueOf((int) bot.getY());
                break;
            case "{z}":
                textToCompare = String.valueOf((int) bot.getZ());
                break;
            default:
                Log.warn("Unknown placeholder in IF condition: " + placeholder);
                return false;
        }

        if (textToCompare == null) {
            return false;
        }

        switch (operator) {
            case "is":
                return textToCompare.equalsIgnoreCase(value);
            case "isnot":
                return !textToCompare.equalsIgnoreCase(value);
            case "contains":
                return textToCompare.toLowerCase().contains(value.toLowerCase());
            case "notcontains":
                return !textToCompare.toLowerCase().contains(value.toLowerCase());
            default:
                return false;
        }
    }
}