const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🕵️ EMERGENCY LOGGER ---
app.use((req, res, next) => {
    console.log(`📡 [LOG]: ${req.method} request to: ${req.url}`);
    next();
});

// --- 1. THE "BLUE CIRCLE" KILLER (Handles Root and Handshake) ---
// We put the same logic in both places so Monday can't miss it.
const handshakeResponse = (req, res) => {
    console.log("🟦 [HANDSHAKE]: Sending metadata for columnId");
    return res.status(200).json({
        type: "status-column-value",
        outboundType: "status-column-value",
        contextualParameters: {
            columnId: "columnId" // Matches your dependency key exactly
        }
    });
};

app.all('/', handshakeResponse);
app.all('/get-status-field-defs', handshakeResponse);

// --- 2. REMOTE OPTIONS (Label Fetcher) ---
// This fills the dropdown with your board's labels (Done, Stuck, etc.)
app.post('/get-status-labels', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const { boardId, columnId } = payload.inputFields;

        console.log(`🔍 [FETCHING]: Board ${boardId}, Column ${columnId}`);

        const query = `query {
            boards (ids: ${boardId}) {
                columns (ids: "${columnId}") {
                    settings_str
                }
            }
        }`;

        const response = await axios.post('https://api.monday.com/v2', { query }, {
            headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'API-Version': '2024-01' 
            }
        });

        const settings = JSON.parse(response.data.data.boards[0].columns[0].settings_str);
        
        // Transform internal labels into dropdown options
        const options = Object.entries(settings.labels).map(([id, label]) => ({
            title: label,
            value: id
        }));

        console.log(`✅ [SUCCESS]: Sent ${options.length} status labels.`);
        return res.status(200).json(options);

    } catch (err) {
        console.error("❌ [LABEL ERROR]:", err.message);
        return res.status(200).json([]); 
    }
});

// --- 3. STATIC DROPDOWNS ---
app.all('/get-nth-options', (req, res) => res.json([{ title: "1st", value: "1" }, { title: "2nd", value: "2" }, { title: "3rd", value: "3" }, { title: "4th", value: "4" }]));
app.all('/get-day-options', (req, res) => res.json([{ title: "Monday", value: "1" }, { title: "Tuesday", value: "2" }, { title: "Wednesday", value: "3" }, { title: "Thursday", value: "4" }, { title: "Friday", value: "5" }, { title: "Saturday", value: "6" }, { title: "Sunday", value: "0" }]));

// --- 4. MAIN ACTION ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        console.log("🚀 [ACTION]: Triggered");
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || (payload.inPublic && payload.inPublic.inputFields);
        if (!inputFields) return res.status(200).send({});

        const { boardId, task_name, assignee_id, columnId, status_value } = inputFields;
        const labelText = status_value?.label || status_value?.value || status_value;
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;

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
        await axios.post('https://api.monday.com/v2', { query }, { headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } });

        res.status(200).send({});
    } catch (err) {
        console.error("❌ Action Error:", err.message);
        res.status(200).send({}); 
    }
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
