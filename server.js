const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🔒 SAFE SETTINGS ---
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN; 
const DUE_DATE_COLUMN_ID = process.env.DUE_DATE_COLUMN_ID; 

// --- 1. REMOTE OPTIONS ---
app.all('/get-nth-options', (req, res) => {
    const options = [{ title: "1st", value: "1" }, { title: "2nd", value: "2" }, { title: "3rd", value: "3" }, { title: "4th", value: "4" }];
    return res.status(200).json(options);
});

app.all('/get-day-options', (req, res) => {
    const options = [
        { title: "Monday", value: "1" }, { title: "Tuesday", value: "2" }, { title: "Wednesday", value: "3" }, 
        { title: "Thursday", value: "4" }, { title: "Friday", value: "5" }, { title: "Saturday", value: "6" }, { title: "Sunday", value: "0" }
    ];
    return res.status(200).json(options);
});

function calculateDate(nth, day) {
    const now = new Date();
    let d = new Date(now.getFullYear(), now.getMonth(), 1);
    while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
    return d.toISOString().split('T')[0];
}

// --- 2. DYNAMIC ACTION: Task + Selected Status ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        console.log("--> Dynamic Status Action Triggered");
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || (payload.inPublic && payload.inPublic.inputFields);
        
        if (!inputFields) return res.status(200).send({});

        // Extracting keys: columnID (The Column) and statusColumnValue (The Label)
        const { boardId, task_name, assignee_id, columnID, statusColumnValue } = inputFields; 
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;

        const date = calculateDate(nth, day);

        const columnValues = {
            [DUE_DATE_COLUMN_ID]: { "date": date },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            // Uses the Column ID and Label picked in the recipe
            [columnID]: { "label": statusColumnValue } 
        };

        const query = `mutation { 
            create_item (board_id: ${parseInt(boardId)}, item_name: "${task_name}", column_values: ${JSON.stringify(JSON.stringify(columnValues))}) { id } 
        }`;
        
        const response = await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
        });

        if (response.data.errors) {
            console.error("❌ MONDAY ERROR:", JSON.stringify(response.data.errors));
        } else {
            console.log(`✅ Success! Created item with status "${statusColumnValue}" in column "${columnID}"`);
        }

        res.status(200).send({});
    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        res.status(500).send({ error: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
