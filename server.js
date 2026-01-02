const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🛠️ DYNAMIC MAPPING HANDLER ---
// This handles the "Handshake" to stop the spinning circle and the "Fetch" for labels
app.all('/status-logic', async (req, res) => {
    const payload = req.body.payload || req.body;
    const boardId = payload.boardId || payload.inputFields?.boardId;
    const columnId = payload.columnId || payload.inputFields?.columnId;

    // FETCH PHASE: Returns actual labels once board/column are picked
    if (boardId && columnId) {
        try {
            const query = `query { boards (ids: ${boardId}) { columns (ids: "${columnId}") { settings_str } } }`;
            const response = await axios.post('https://api.monday.com/v2', { query }, {
                headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2024-01' }
            });

            const settings = JSON.parse(response.data.data.boards[0].columns[0].settings_str);
            const fields = Object.entries(settings.labels).map(([id, label]) => ({ 
                id: id,            // This is the INDEX (e.g. "1")
                title: label, 
                outboundType: "text", 
                inboundTypes: ["text"] 
            }));
            return res.status(200).send(fields);
        } catch (e) { return res.status(200).send([]); }
    }

    // HANDSHAKE PHASE: Prevents the blue circle by telling Monday the field is ready
    return res.status(200).send([{ 
        id: "status_value", 
        title: "Status Column Value", 
        outboundType: "text", 
        inboundTypes: ["text"] 
    }]);
});

// --- 🚀 THE CREATE ITEM ACTION ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        
        // Destructuring all keys based on your requirements
        const { boardId, columnId, status_value, task_name, assignee_id } = inputFields;
        
        // Extract the index from the dynamic mapping
        const statusIndex = status_value?.id || status_value;

        // Recurring Date Logic
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);

        // Building the JSON object exactly as Monday AI recommended
        // columnId is used as the KEY, statusIndex is the VALUE inside {"index": X}
        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": d.toISOString().split('T')[0] },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [columnId]: { "index": parseInt(statusIndex) } 
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

        res.status(200).send({});
    } catch (err) {
        console.error("❌ Action failed:", err.message);
        res.status(200).send({});
    }
});

// Dropdown Helpers
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

const PORT = 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
