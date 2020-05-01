$(function () {
    $('#pageData').DataTable({
        ajax: 'datareports.json',
        order: [[2, 'asc']], 
        stateSave: true,
        lengthMenu: [[50, 100, -1], [50, 100, 'All']],
        dom: '<"top"iflp<"clear">>rt<"bottom"iflp<"clear">>',
        rowReorder: true,
        columns: [
            {
                data: 'title',
                title: 'Title',
                render: (data, type, row, meta) => {
                    return data.trim() ? data : '<div class="text-danger font-weight-bold">Title missing</div>'
                }
            },
            {
                data: 'description',
                title: 'Description',
                render: (data, type, row, meta) => {
                    return lengthChecker(data)
                }
            },
            {
                data: 'url',
                title: 'URL <small>redirect, canonical</small>',
                render: (data, type, row, meta) => {
                    return `<a href="${data}" target="_blank">${data}</a><div class="text-danger">${data === row.redirectUrl ? '' : 'Redirected to: ' + row.redirectUrl}</div><div class="text-info">${data === row.canonicalURL ? '' : 'Canonical: ' + row.canonicalURL}</div>`
                }
            },
            {
                data: 'perfScore',
                title: 'Performance',
                render: (data, type, row, meta) => {
                    return colorize(data);
                }
            },
            {
                data: 'accScore',
                title: 'Acc | B.Pract. | SEO',
                render: (data, type, row, meta) => {
                    return `${colorize(data)} | ${colorize(row.bpScore)} | ${colorize(row.seoScore)}`;
                }
            },
            {
                data: 'fileName',
                title: 'Report',
                render: (data, type, row, meta) => {
                    return `<a class="btn btn-outline-primary btn-sm" href="data/${data}" target="_blank">Display</a>`;
                }
            }
        ]
    });

    // apply class to header
    $('#pageData thead').addClass('thead-dark')

    // style score
    const colorize = (number) => {
        let cssClass = 'text-primary'
        if (number < 0.5) {
            cssClass = 'text-danger';
        } else if (number < 0.9) {
            cssClass = 'text-warning';
        } else {
            cssClass = 'text-success';
        }
        return `<span class="${cssClass}">${Math.round(number * 100)}</span>`
    }

    // style description
    const lengthChecker = (desc) => {
        let descLen = desc.trim().length
        let cont = '<div class="text-success">Optimal: less than 160</div>';
        if (!descLen) {
            return '<div class="text-danger font-weight-bold">Description missing</div>'
        } else if (descLen < 50) {
            return '<div class="text-danger">Too few characters: ' + descLen + '</div>' + cont;
        } else if (descLen > 50 && descLen <= 160) {
            return '<div class="text-success">Optimal length</div>'
        } else {
            return '<div class="text-danger">Too many Characters: ' + descLen + '</div>' + cont
        }

    }


});
