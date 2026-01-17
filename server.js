app.post('/calculate-task-with-tag', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const inputFields = payload.inboundFieldValues || payload.inputFields;
        
        const { boardId, tagsColumn, tag_names, task_name, assignee_id } = inputFields;

        // Date logic
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);

        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": d.toISOString().split('T')[0] },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] },
            [tagsColumn]: { "tag_ids": [tag_names] } 
        };

        const query = `mutation { 
            create_item (
                board_id: ${parseInt(boardId)}, 
                item_name: "${task_name}", 
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id } 
        }`;

        // Send the request and capture the response
        const response = await axios.post('https://api.monday.com/v2', { query }, { 
            headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'API-Version': '2024-01' 
            } 
        });

        // CHECK FOR API-LEVEL ERRORS
        if (response.data.errors) {
            console.error("❌ MONDAY API ERROR:", JSON.stringify(response.data.errors, null, 2));
        } else {
            console.log(`✅ Success! Created Item ID: ${response.data.data.create_item.id}`);
        }

        res.status(200).send({});
    } catch (err) {
        // Log the actual server/network error
        console.error("❌ SERVER ERROR:", err.response?.data || err.message);
        res.status(200).send({});
    }
});
