const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN; 
const DUE_DATE_COLUMN_ID = process.env.DUE_DATE_COLUMN_ID; 

// --- 1. FIELD DEFINITION (This kills the blue circle) ---
app.post('/get-status-field-defs', (req, res) => {
    console.log("🟦 [LOG]: Monday is requesting the Status labels metadata.");
    return res.status(200).json({
        type: "status-column-value",
        outboundType: "status-column-value",
        contextualParameters: {
            columnId: "columnID" // MUST match your Status Column Picker key exactly
        }
    });
});

// --- 2. DROPDOWN OPTIONS (Nth and Day) ---
app.all('/get-nth-options', (req, res) => {
    console.log("🟢 [LOG]: Fetching Nth occurrence options.");
    res.json([{ title: "1st", value: "1" }, { title: "2nd", value: "2" }, { title: "3rd", value: "3" }, { title: "4th", value: "4" }]);
});

app.all('/get-day-options', (req, res) => {
    console.log("🟢 [LOG]: Fetching Day of week options.");
    res.json([{ title: "Monday", value: "1" }, { title: "Tuesday", value: "2" }, { title: "Wednesday", value: "3" }, { title: "Thursday", value: "4" }, { title: "Friday", value: "5" }, { title: "Saturday", value: "6" }, { title: "Sunday", value: "0" }]);
});

// --- 3. THE ITEM CREATION ACTION ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        console.log("🚀 [LOG]: Recipe triggered! Creating task...");
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || (payload.inPublic && payload.inPublic.inputFields);
        if (!inputFields) return res.status(200).send({});

        const { boardId, task_name, assignee_id, columnID, status_value } = inputFields;
        const labelText = status_value?.label || status_value?.value || status_value;
        
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;

        // Date logic: 1st [day] of the month
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
        const date = d.toISOString().split('T')[0];

        const columnValues = {
            [DUE_DATE_COLUMN_ID]: { "date": date },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [columnID]: { "label": labelText } 
        };

        const query = `mutation { 
            create_item (
                board_id: ${parseInt(boardId)}, 
                item_name: "${task_name || 'Recurring Task'}", 
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
        });

        console.log(`✨ [LOG]: Success! Created item with status: ${labelText}`);
        res.status(200).send({});
    } catch (err) {
        console.error("❌ [LOG] Error:", err.message);
        res.status(200).send({}); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`📡 [LOG]: Server live on port ${PORT}`));
