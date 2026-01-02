const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🕵️ LOGGING ---
app.use((req, res, next) => {
    console.log(`📡 [LOG]: ${req.method} request to: ${req.url}`);
    next();
});

// --- 1. THE COMBINED HANDLER (Put this in your one and only URL box) ---
// Use this path: /get-status-field-defs
app.all('/get-status-field-defs', async (req, res) => {
    const payload = req.body.payload || req.body;

    // IF Monday sends inputFields, it is asking for the dropdown labels
    if (payload.inputFields && payload.inputFields.boardId) {
        try {
            const { boardId, columnId } = payload.inputFields;
            console.log(`🔍 [FETCHING]: Getting labels for Board ${boardId}, Column ${columnId}`);

            const query = `query { boards (ids: ${boardId}) { columns (ids: "${columnId}") { settings_str } } }`;
            const response = await axios.post('https://api.monday.com/v2', { query }, {
                headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'API-Version': '2024-01' }
            });

            const settings = JSON.parse(response.data.data.boards[0].columns[0].settings_str);
            
            // Map labels to Title (Text) and Value (Index/ID)
            const options = Object.entries(settings.labels).map(([id, label]) => ({
                title: label,
                value: id // This is the 'Index' mentioned in your AI convo
            }));

            console.log(`✅ [SUCCESS]: Found ${options.length} labels.`);
            return res.status(200).json(options);
        } catch (err) {
            console.error("❌ Label Error:", err.message);
            return res.status(200).json([]);
        }
    }

    // DEFAULT: Handshake (Stops the blue circle)
    console.log("🟦 [HANDSHAKE]: Sending metadata for columnId");
    return res.status(200).json({
        type: "status-column-value",
        outboundType: "status-column-value",
        contextualParameters: { columnId: "columnId" }
    });
});

// --- 2. THE UPDATED ACTION (Using Label Index) ---
app.post('/calculate-task-with-status', async (req, res) => {
    try {
        console.log("🚀 [ACTION]: Triggered");
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || (payload.inPublic && payload.inPublic.inputFields);
        if (!inputFields) return res.status(200).send({});

        const { boardId, task_name, assignee_id, columnId, status_value } = inputFields;

        // Determine the label value (Index or Label Text)
        // status_value will now contain the 'value' (index) from our fetcher
        const statusLabelValue = status_value?.value || status_value;

        // Date calculation for the recurring task
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
        const date = d.toISOString().split('T')[0];

        // Construct column values using the Index/ID method
        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": date },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [columnId]: { "index": parseInt(statusLabelValue) } // Using Index for stability
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

        console.log("✨ Item Created Successfully");
        res.status(200).send({});
    } catch (err) {
        console.error("❌ Action Error:", err.message);
        res.status(200).send({}); 
    }
});

// Static Options for the rest of the recipe
app.all('/get-nth-options', (req, res) => res.json([{title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}]));
app.all('/get-day-options', (req, res) => res.json([{title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}]));

app.listen(process.env.PORT || 10000, '0.0.0.0');
