const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🛠️ THE DYNAMIC MAPPING HANDLER ---
// URL: https://YOUR-URL.onrender.com/status-logic
app.all('/status-logic', async (req, res) => {
    const payload = req.body.payload || req.body;
    
    // boardId and columnId come from the Monday recipe context
    const boardId = payload.boardId || payload.inputFields?.boardId;
    const columnId = payload.columnId || payload.inputFields?.columnId;

    // FETCH PHASE: Returns the actual labels to the user
    if (boardId && columnId) {
        try {
            const query = `query { boards (ids: ${boardId}) { columns (ids: "${columnId}") { settings_str } } }`;
            const response = await axios.post('https://api.monday.com/v2', { query }, {
                headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2024-01' }
            });

            const settings = JSON.parse(response.data.data.boards[0].columns[0].settings_str);
            
            // Map labels into the required array format for Dynamic Mapping
            const fields = Object.entries(settings.labels).map(([id, label]) => ({ 
                id: id,            // This is the INDEX (e.g., "1")
                title: label, 
                outboundType: "text", 
                inboundTypes: ["text"] 
            }));
            return res.status(200).send(fields);
        } catch (e) { 
            return res.status(200).send([]); 
        }
    }

    // HANDSHAKE PHASE: Initial load to stop the blue circle
    // Sending an array even if data is missing tells Monday the endpoint is ready
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
        
        const { boardId, columnId, status_value, task_name, assignee_id } = inputFields;
        
        // Extracting the 'id' which we mapped to the status Index
        const statusIndex = status_value?.id || status_value;

        // Date Logic
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);

        // CREATE ITEM using the Index method as recommended
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
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json', 'API-Version': '2024-01' } 
        });

        res.status(200).send({});
    } catch (err) { 
        res.status(200).send({}); 
    }
});

// Static dropdowns
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

const PORT = 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
