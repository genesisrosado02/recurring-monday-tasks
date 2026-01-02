const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🕵️ GLOBAL LOGGER ---
app.use((req, res, next) => {
    console.log(`📡 [LOG]: ${req.method} request to: ${req.url}`);
    next();
});

// --- 1. ROOT HANDLER (Fixes the "GET to /" in your logs) ---
app.get('/', (req, res) => {
    res.status(200).send("Render server is LIVE and waiting for Monday.com!");
});

// --- 2. FIELD DEFINITION (Matches image_ddee70.png) ---
app.post('/get-status-field-defs', (req, res) => {
    console.log("🟦 [HANDSHAKE]: Monday requested metadata for 'columnId'");
    return res.status(200).json({
        type: "status-column-value",
        outboundType: "status-column-value",
        contextualParameters: {
            columnId: "columnId" // This MUST match your screenshot exactly
        }
    });
});

// --- 3. OPTIONS LOADERS ---
app.all('/get-nth-options', (req, res) => {
    res.json([{ title: "1st", value: "1" }, { title: "2nd", value: "2" }, { title: "3rd", value: "3" }, { title: "4th", value: "4" }]);
});

app.all('/get-day-options', (req, res) => {
    res.json([{ title: "Monday", value: "1" }, { title: "Tuesday", value: "2" }, { title: "Wednesday", value: "3" }, { title: "Thursday", value: "4" }, { title: "Friday", value: "5" }, { title: "Saturday", value: "6" }, { title: "Sunday", value: "0" }]);
});

// --- 4. MAIN ACTION HANDLER ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        console.log("🚀 [ACTION]: Triggered!");
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || (payload.inPublic && payload.inPublic.inputFields);
        
        if (!inputFields) return res.status(200).send({});

        const { boardId, task_name, assignee_id, columnId, status_value } = inputFields;
        const labelText = status_value?.label || status_value?.value || status_value;
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;

        // Date calculation logic
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
        const date = d.toISOString().split('T')[0];

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": date },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [columnId]: { "label": labelText } 
        };

        const query = `mutation { create_item (board_id: ${parseInt(boardId)}, item_name: "${task_name}", column_values: ${JSON.stringify(JSON.stringify(columnValues))}) { id } }`;
        
        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
        });

        console.log("✨ Success: Item created.");
        res.status(200).send({});
    } catch (err) {
        console.error("❌ Action Error:", err.message);
        res.status(200).send({}); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server listening on port ${PORT}`));
