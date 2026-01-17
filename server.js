const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

// --- 🌐 HEALTH CHECK ---
app.get('/', (req, res) => res.status(200).send("OK"));

// --- 📅 DROPDOWN ENDPOINTS ---
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

// --- 🚀 YOUR SPECIFIED ROUTE ---
app.post('/calculate-task-with-tag', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        
        // Ensure these keys match your Monday Developer Center exactly
        const { boardId, tagsColumn, tag_names, task_name, assignee_id } = inputFields;

        // Recurring Date Logic
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": d.toISOString().split('T')[0] },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [tagsColumn]: { "tag_ids": [tag_names] } // Sets tag by text label
        };

        const query = `mutation { 
            create_item (
                board_id: ${parseInt(boardId)}, 
                item_name: "${task_name}", 
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id } 
        }`;

        await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2024-01' } 
        });

        console.log(`✅ Success: Created "${task_name}" with tag "${tag_names}"`);
        res.status(200).send({});
    } catch (err) {
        console.error("❌ Action Error:", err.message);
        res.status(200).send({});
    }
});

// --- 🛡️ SAFETY CATCH-ALL ---
app.use((req, res) => res.status(200).json([]));

const PORT = 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
