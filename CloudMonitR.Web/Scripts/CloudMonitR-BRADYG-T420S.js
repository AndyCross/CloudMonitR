﻿/// <reference path="jquery-1.8.1.js" />
/// <reference path="jquery.signalR-0.5.3.js" />
/// <reference path="highcharts.js" />

function deleteCounter(id) {
    alert(id);
}

$(document).ready(function () {

    function cleanString(s) {
        var r = s.replace(/[^a-z0-9]/gi, '').replace(' ', '');
        return r;
    }

    counterViewModel = function (nm, cntInst) {
        self = this;
        self.counterInstance = cntInst;
        self.id = cleanString(nm + cntInst);
        self.name = nm;
        self.series = [];
    };

    pageViewModel = function () {
        self = this;
        self.counters = [];
    };

    counterCategoryMenuItem = function (n, i) {
        self = this;
        self.category = n;
        self.instances = i;
    };

    var cn = $.hubConnection();
    var hub = cn.createProxy("cloudMonitR");
    var viewModel = new pageViewModel();
    var charts = [];
    var counterCategoryMenuItems = [];

    hub.on('showChartData', function (v) {
        drawPoint(v.name, v.value, v.instanceId, v.counterInstance);
    });

    hub.on('showTrace', function (msg) {
        $('<li>' + msg.body + '</li>').prependTo('#traceMessages').hide().slideDown();
        for (var i = $('#traceMessages').children('li').length; i > 19; i--) {
            $($('#traceMessages').children('li')[i]).fadeOut('fast', function () {
                $($('#traceMessages').children('li')[i]).remove();
            });
        }
    });

    hub.on('onSendPerformanceCounterCategoriesToDashboard', function (categories) {
        if (counterCategoryMenuItems.length > 0) return;

        $(categories).each(function (i, item) {
            var newItem = new counterCategoryMenuItem(item.Name, item.Instances);
            counterCategoryMenuItems.push(newItem);
        });

        $(counterCategoryMenuItems).each(function (i, item) {
            $('#counterCategories').append('<option class="categoryOption">' + item.category + '</option>');
        });

        loadInstanceMenu();
        $('#counterCategories').focus();
    });

    hub.on('onSendPerformanceCountersToDashboard', function (counters) {
        $('#counterMenu').children('option').remove();
        $(counters).each(function (i, item) {
            $('#counterMenu').append('<option>' + item + '</option>');
        });
    });

    hub.on('onWorkerReady', function () {
        if (counterCategoryMenuItems.length == 0) {
            hub.invoke('getPerformanceCounterCategories');
        }
    });

    cn.start().done(function () {
        hub.invoke('start');
        if (counterCategoryMenuItems.length == 0) {
            hub.invoke('getPerformanceCounterCategories');
        }
    });

    $('#addButton').click(function () {
        hub.invoke('addCounterToDashboard',
            $('#counterCategories').val(),
            $('#counterInstances').val(),
            $('#counterMenu').val());
    });

    $('#counterCategories').change(function () {
        loadInstanceMenu();
    });

    $('#counterInstances').change(function () {
        loadCounterMenu();
    });

    $('.deleteCounter').live('click', function (i) {
        hub.invoke('deleteCounter', $(this).data('counter'), $(this).data('instance'));

        var cntr = $(this).data('counter');
        var inst = $(this).data('instance');
        var id = cleanString(cntr + inst);

        $('#' + id).fadeOut('fast', function () {
            $('#' + id).remove();
            $('#control_' + id).remove();

            for (var x = viewModel.counters.length - 1; x >= 0; x--) {
                if (viewModel.counters[x].id == id) {
                    viewModel.counters.splice(x, 1);

                    for (var c = charts.length - 1; c >= 0; c--) {
                        var ttl = cntr + ' - ' + inst;
                        if (charts[c].title.text == ttl) {
                            charts.splice(c, 1);
                        }
                    }
                    break;
                }
            }
        });
    });

    function loadInstanceMenu() {
        $('#counterInstances').children('option').remove();
        $(counterCategoryMenuItems).each(function (i, item) {
            if (item.category == $('#counterCategories').val()) {
                $(item.instances).each(function (x, inst) {
                    $('#counterInstances').append('<option>' + inst + '</option>');
                });
            }
        });
        loadCounterMenu();
    }

    function loadCounterMenu() {
        hub.invoke('getPerformanceCounters',
            $('#counterCategories').val(),
            $('#counterInstances').val());
    }

    function createCharts() {
        charts = [];

        for (var i = 0; i < viewModel.counters.length; i++) {
            if ($('#' + viewModel.counters[i].id).length == 0) {
                $('#chartingContainer').append('<div class="chartContainer" id="' + viewModel.counters[i].id + '"></div>');
                $('#chartingContainer').append('<div class="chartControls" id="control_' + viewModel.counters[i].id + '"><button class="btn btn-danger deleteCounter" data-counter="' + viewModel.counters[i].name + '" data-instance="' + viewModel.counters[i].counterInstance + '">Delete</button></div>');
            }

            var options = {
                chart: {
                    renderTo: viewModel.counters[i].id,
                    type: 'line',
                    borderColor: '#000',
                    borderRadius: 5,
                    borderWidth: 1
                },
                title: { text: viewModel.counters[i].name + ' - ' + viewModel.counters[i].counterInstance },
                xAxis: { categories: [viewModel.counters[i].name] },
                yAxis: { title: { text: viewModel.counters[i].name } },
                series: []
            };

            for (var x = 0; x < viewModel.counters[i].series.length; x++) {
                var s = { data: [] };
                s.name = viewModel.counters[i].series[x];
                options.series.push(s);
            }

            chart = new Highcharts.Chart(options);
            charts.push(chart);
        }
    }

    function drawPoint(name, value, instanceId, counterInstanceName) {

        var counterExists = false;

        for (var i = 0; i < viewModel.counters.length; i++) {
            if (viewModel.counters[i].name == name && viewModel.counters[i].counterInstance == counterInstanceName) {
                counterExists = true;
                break;
            }
        }

        if (!counterExists) {
            viewModel.counters.push(new counterViewModel(name, counterInstanceName));
        }

        var seriesExists = false;
        for (var i = 0; i < viewModel.counters.length; i++) {
            if (viewModel.counters[i].name == name && viewModel.counters[i].counterInstance == counterInstanceName) {
                for (var x = 0; x < viewModel.counters[i].series.length; x++) {
                    if (viewModel.counters[i].series[x] == instanceId) {
                        seriesExists = true;
                        break;
                    }
                }

                if (seriesExists == false) {
                    viewModel.counters[i].series.push(instanceId);
                    createCharts();
                }
            }
        }

        for (var i = 0; i < charts.length; i++) {
            if (charts[i].title.text == name + ' - ' + counterInstanceName) {
                for (var x = 0; x < charts[i].series.length; x++) {
                    if (charts[i].series[x].name == instanceId) {
                        var shift = charts[i].series[x].data.length > 20;
                        charts[i].series[x].addPoint(value, true, shift);
                    }
                }
            }
        }
    };
});