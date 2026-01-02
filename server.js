const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🔒 ENVIRONMENT VARIABLES ---
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN; 
const DUE_DATE_COLUMN_ID = process.env.DUE_DATE_COLUMN_ID; 

// --- 1. HEALTH CHECK (To verify Render is awake) ---
app.get('/health', (req, res) => {
    res.status(200).send("Server is live and reachable.");
});

/**
 * 2. FIELD DEFINITION (Dynamic Mapping)
 * This is the handshake that stops the blue circle.
 * It links your 'status_value' field to the 'columnId' picker.
 */
app.post('/get-status-field-defs', (req, res) => {
    console.log("🟦 [LOG]: Handshake received. Sending field metadata...");
    
    // Returning 200 with the exact expected JSON structure
    return res.status(200).json({
        type: "status-column-value",
        outboundType: "status-column-value",
        contextualParameters: {
            columnId: "columnId" // Matches your screenshot key exactly
        }
    });
});

/**
 * 3. REMOTE OPTIONS
 * Dropdown choices for the Nth occurrence and Day of the Week.
 */
app.all('/get-nth-options', (req, res) => {
    console.log("🟢 [LOG]: Fetching Nth options");
    res.json([
        { title: "1st", value: "1" }, { title: "2nd", value: "2" }, 
        { title: "3rd", value: "3" }, { title: "4th", value: "4" }
    ]);
});

app.all('/get-day-options', (req, res) => {
    console.log("🟢 [LOG]: Fetching Day options");
    res.json([
        { title: "Monday", value: "1" }, { title: "Tuesday", value: "2" }, 
        { title: "Wednesday", value: "3" }, { title: "Thursday", value: "4" }, 
        { title: "Friday", value: "5" }, { title: "Saturday", value: "6" }, { title: "Sunday", value: "0" }
    ]);
});

/**
 * 4. MAIN ACTION: Create Task
 * Triggered when the automation runs.
 */
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        console.log("🚀 [LOG]: Action received. Processing payload...");
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || (payload.inPublic && payload.inPublic.inputFields);
        
        if (!inputFields) return res.status(200).send({});

        // Keys synced to your screenshots: columnId and status_value
        const { boardId, task_name, assignee_id, columnId, status_value } = inputFields;
        
        // Extract label from dynamic mapping object
        const labelText = status_value?.label || status_value?.value || status_value;
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;

        // Date Calculation Logic
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

        const query = `mutation { 
            create_item (
                board_id: ${parseInt(boardId)}, 
                item_name: "${task_name || 'Recurring Task'}", 
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id } 
        }`;

        const response = await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 
                'Authorization': MONDAY_API_TOKEN, 
                'Content-Type': 'application/json', 
                'API-Version': '2024-01' 
            } 
        });

        if (response.data.errors) {
            console.error("❌ [LOG] Monday API Error:", response.data.errors);
        } else {
            console.log(`✨ [LOG] Task Created! Status: ${labelText} in Column: ${columnId}`);
        }

        res.status(200).send({});
    } catch (err) {
        console.error("🔥 [LOG] Server Error:", err.message);
        res.status(200).send({}); // Always return 200 to Monday
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`📡 Server listening on port ${PORT}`));
