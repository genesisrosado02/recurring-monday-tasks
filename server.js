const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🕵️ EMERGENCY LOGGER ---
// This will show EVERY hit to your server in the Render logs
app.use((req, res, next) => {
    console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} to ${req.url}`);
    next();
});

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN; 
const DUE_DATE_COLUMN_ID = process.env.DUE_DATE_COLUMN_ID; 

// --- 1. HEALTH CHECK ---
app.get('/health', (req, res) => res.status(200).send("Server is awake!"));

// --- 2. FIELD DEFINITION (Matches columnId) ---
app.post('/get-status-field-defs', (req, res) => {
    console.log("🟦 [HANDSHAKE]: Sending metadata for columnId");
    return res.status(200).json({
        type: "status-column-value",
        outboundType: "status-column-value",
        contextualParameters: {
            columnId: "columnId" // Matches your Monday configuration exactly
        }
    });
});

// --- 3. REMOTE OPTIONS ---
app.all('/get-nth-options', (req, res) => res.json([{ title: "1st", value: "1" }, { title: "2nd", value: "2" }, { title: "3rd", value: "3" }, { title: "4th", value: "4" }]));
app.all('/get-day-options', (req, res) => res.json([{ title: "Monday", value: "1" }, { title: "Tuesday", value: "2" }, { title: "Wednesday", value: "3" }, { title: "Thursday", value: "4" }, { title: "Friday", value: "5" }, { title: "Saturday", value: "6" }, { title: "Sunday", value: "0" }]));

// --- 4. MAIN ACTION ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || (payload.inPublic && payload.inPublic.inputFields);
        if (!inputFields) return res.status(200).send({});

        // Synced key: columnId
        const { boardId, task_name, assignee_id, columnId, status_value } = inputFields;
        const labelText = status_value?.label || status_value?.value || status_value;
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;

        // Date logic
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
        const date = d.toISOString().split('T')[0];

        const columnValues = {
            [DUE_DATE_COLUMN_ID]: { "date": date },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [columnId]: { "label": labelText } 
        };

        const query = `mutation { create_item (board_id: ${parseInt(boardId)}, item_name: "${task_name}", column_values: ${JSON.stringify(JSON.stringify(columnValues))}) { id } }`;
        await axios.post('https://api.monday.com/v2', { query }, { headers: { 'Authorization': MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } });

        console.log(`✅ SUCCESS: Item created with status "${labelText}" in column "${columnId}"`);
        res.status(200).send({});
    } catch (err) {
        console.error("❌ Action Error:", err.message);
        res.status(200).send({}); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server listening on ${PORT}`));
