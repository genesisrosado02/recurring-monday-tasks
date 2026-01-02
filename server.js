const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🚀 THE CREATE ITEM ACTION ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        
        // Destructuring the new text-based key
        const { boardId, columnId, status_label_text, task_name, assignee_id } = inputFields;

        // Recurring Date Logic
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);

        // CREATE ITEM using the Label method
        // columnId is the key, and we pass the text inside {"label": "TEXT"}
        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": d.toISOString().split('T')[0] },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [columnId]: { "label": status_label_text } 
        };

        const query = `mutation { 
            create_item (
                board_id: ${parseInt(boardId)}, 
                item_name: "${task_name}", 
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'Content-Type': 'application/json', 
                'API-Version': '2024-01' 
            } 
        });

        console.log(`✅ Item created with status label: ${status_label_text}`);
        res.status(200).send({});
    } catch (err) {
        console.error("❌ Action failed:", err.message);
        res.status(200).send({});
    }
});

// Dropdown Helpers for recurring logic
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

const PORT = 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
