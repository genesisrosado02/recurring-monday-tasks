const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🔒 CONFIGURATION ---
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN; 
const DUE_DATE_COLUMN_ID = process.env.DUE_DATE_COLUMN_ID; 

/**
 * 1. DYNAMIC MAPPING DEFINITION
 * This endpoint is what you put into the "Field Definitions URL" in your screenshot.
 * It tells monday.com to link 'status_value' to the board's 'columnID'.
 */
app.post('/get-status-field-defs', (req, res) => {
    return res.status(200).json({
        type: "status-column-value",
        outboundType: "status-column-value",
        contextualParameters: {
            columnId: "columnID" // Must match the key of your Status Column picker
        }
    });
});

/**
 * 2. REMOTE OPTIONS
 * These provide the dropdown choices for the Nth occurrence and Day of the Week.
 */
app.all('/get-nth-options', (req, res) => {
    res.json([
        { title: "1st", value: "1" }, 
        { title: "2nd", value: "2" }, 
        { title: "3rd", value: "3" }, 
        { title: "4th", value: "4" }
    ]);
});

app.all('/get-day-options', (req, res) => {
    res.json([
        { title: "Monday", value: "1" }, { title: "Tuesday", value: "2" }, 
        { title: "Wednesday", value: "3" }, { title: "Thursday", value: "4" }, 
        { title: "Friday", value: "5" }, { title: "Saturday", value: "6" }, 
        { title: "Sunday", value: "0" }
    ]);
});

/**
 * 3. DATE CALCULATION HELPER
 */
function calculateDate(nth, day) {
    const now = new Date();
    let d = new Date(now.getFullYear(), now.getMonth(), 1);
    while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
    return d.toISOString().split('T')[0];
}

/**
 * 4. MAIN ACTION: Create Task with Dynamic Status
 */
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || (payload.inPublic && payload.inPublic.inputFields);
        
        if (!inputFields) return res.status(200).send({});

        // Keys: columnID (the picker) and status_value (the labels)
        const { boardId, task_name, assignee_id, columnID, status_value } = inputFields;
        
        // Dynamic mapping usually sends an object; extract the text label
        const labelText = status_value?.label || status_value?.value || status_value;
        
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;

        const date = calculateDate(nth, day);

        const columnValues = {
            [DUE_DATE_COLUMN_ID]: { "date": date },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            // Update the specific status column chosen in the recipe
            [columnID]: { "label": labelText } 
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
            console.error("❌ Monday API Error:", JSON.stringify(response.data.errors));
        } else {
            console.log(`✅ Task Created: ${task_name} with status ${labelText}`);
        }

        res.status(200).send({});
    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        res.status(500).send({ error: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
