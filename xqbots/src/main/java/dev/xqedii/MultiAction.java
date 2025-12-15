package dev.xqedii;

import java.util.List;

public class MultiAction {
    private final String trigger;
    private final List<String> lines;
    private int currentIndex = 0;

    public MultiAction(String trigger, List<String> lines) {
        this.trigger = trigger;
        this.lines = lines;
    }

    public String getTrigger() {
        return trigger;
    }

    public List<String> getLines() {
        return lines;
    }

    public synchronized String getNextLine() {
        if (lines.isEmpty()) return null;

        int start = currentIndex;
        do {
            String line = lines.get(currentIndex);
            currentIndex++;
            if (currentIndex >= lines.size()) currentIndex = 0;

            line = line.trim();
            if (!line.isEmpty() && !line.startsWith("#")) {
                return line;
            }
        } while (currentIndex != start);

        return null;
    }
}