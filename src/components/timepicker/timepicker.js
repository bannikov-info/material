/**
 * @ngdoc module
 * @name material.components.timepicker
 * @description
 *
 * Timepicker
 */
angular
    .module('material.components.timepicker', [
      'material.core',
      'material.components.datepicker'
    ])
    .directive('mdTimepicker', MdTimepickerDirective);


    /**
     * @ngdoc directive
     * @name mdTimepicker
     * @module material.components.timepicker
     * @restrict E
     * @description
     * The `<md-timepicker>` component.
     *
     * @usage
     * <h4>Normal Mode</h4>
     * <hljs lang="html">
     *   <md-timepicker ng-model="myDatetime">
     *   </md-slider>
     * </hljs>
     *
     * @param {Date} ng-model The component's model. Should be a Date object.
     *
     */
    function MdTimepickerDirective($mdTheming) {
      return {
        restrict: 'E',
        transclude: true,
        template: [
          '<div class="timepicker-pane">',
          '  <div class="dial" data-selected="{{timepickerCtrl.sel}}">',
          '    <div class="dial-hour-hand-container"></div>',
          '    <div>',
          '      <div class="dial-digit-container"',
          '         ng-repeat="dg in timepickerCtrl.digits"',
          '         ng-click="timepickerCtrl.selectDigit($index+1)">',
          '        <div class="dial-digit">{{dg}}</div>',
          '      </div>',
          '    </div>',
          '  </div>',
          '</div>'
        ].join(''),
        require: ['ngModel', 'mdTimepicker'],
        controller: TimepickerCtrl,
        controllerAs: 'timepickerCtrl',
        bindToController: true,
        scope: {
          _currentView: '@mdCurrentView'
        },
        link: function(scope, element, attrs, controllers) {
          var ngModelCtrl = controllers[0];
          var mdTmepickerCtrl = controllers[1];
          mdTmepickerCtrl.configureNgModel(ngModelCtrl);
        }
      }
    };

    /**
     * Controller for the mdTimepicker component.
     * @ngInject @constructor
     */
    function TimepickerCtrl($element, $scope, $$mdDateUtil, $mdUtil,
      $mdConstant, $mdTheming, $$rAF, $attrs) {

      $mdTheming($element);

      /** @final {!angular.JQLite} */
      this.$element = $element;

      /** @final {!angular.Scope} */
      this.$scope = $scope;

      /** @final */
      this.dateUtil = $$mdDateUtil;

      /** @final */
      this.$mdUtil = $mdUtil;

      /** @final */
      this.keyCode = $mdConstant.KEY_CODE;

      /** @final */
      this.$$rAF = $$rAF;

      /** @final {Date} */
      this.today = this.dateUtil.createDateAtMidnight();

      /** @type {!angular.NgModelController} */
      this.ngModelCtrl = null;

      /**
       * The currently visible calendar view. Note the prefix on the scope value,
       * which is necessary, because the datepicker seems to reset the real one value if the
       * calendar is open, but the value on the datepicker's scope is empty.
       * @type {String}
       */
      this.currentView = this._currentView || 'hour';

      /** @type {String} Class applied to the selected date cell. */
      this.SELECTED_MOMENT_CLASS = 'md-timepicker-selected-moment';

      /** @type {String} Class applied to the cell for today. */
      this.NOW_CLASS = 'md-timepicker-time-now';

      /** @type {String} Class applied to the focused cell. */
      this.FOCUSED_MOMENT_CLASS = 'md-focus';

      /** @final {number} Unique ID for this calendar instance. */
      // this.id = nextUniqueId++;

      /**
       * The date that is currently focused or showing in the calendar. This will initially be set
       * to the ng-model value if set, otherwise to today. It will be updated as the user navigates
       * to other months. The cell corresponding to the displayDate does not necesarily always have
       * focus in the document (such as for cases when the user is scrolling the calendar).
       * @type {Date}
       */
      this.displayTime = null;

      /**
       * The selected date. Keep track of this separately from the ng-model value so that we
       * can know, when the ng-model value changes, what the previous value was before it's updated
       * in the component's UI.
       *
       * @type {Date}
       */
      this.selectedTime = null;

      /**
       * Used to toggle initialize the root element in the next digest.
       * @type {Boolean}
       */
      this.isInitialized = false;

      /**
       * Cache for the  width of the element without a scrollbar. Used to hide the scrollbar later on
       * and to avoid extra reflows when switching between views.
       * @type {Number}
       */
      this.width = 0;

      /**
       * Caches the width of the scrollbar in order to be used when hiding it and to avoid extra reflows.
       * @type {Number}
       */
      this.scrollbarWidth = 0;

      // Unless the user specifies so, the calendar should not be a tab stop.
      // This is necessary because ngAria might add a tabindex to anything with an ng-model
      // (based on whether or not the user has turned that particular feature on/off).
      if (!$attrs.tabindex) {
        $element.attr('tabindex', '-1');
      }

      // $element.on('keydown', angular.bind(this, this.handleKeyEvent));

      this.digits = ['00', '05','10','15','20','25','30','35','40','45','50','55'];

      this.sel = 1;
    }

    /**
     * Sets up the controller's reference to ngModelController.
     * @param {!angular.NgModelController} ngModelCtrl
     */
    TimepickerCtrl.prototype.configureNgModel = function(ngModelCtrl) {
      var self = this;

      self.ngModelCtrl = ngModelCtrl;

      self.$mdUtil.nextTick(function() {
        self.isInitialized = true;
      });

      ngModelCtrl.$render = function() {
        var value = this.$viewValue;

        // Notify the child scopes of any changes.
        self.$scope.$broadcast('md-timepicker-parent-changed', value);

        // Set up the selectedDate if it hasn't been already.
        if (!self.selectedTime) {
          self.selectedTime = value;
        }

        // Also set up the displayDate.
        if (!self.displayTime) {
          self.displayTime = self.selectedTime || self.today;
        }
      };
    };

    /**
     * Sets the ng-model value for the calendar and emits a change event.
     * @param {Date} date
     */
    TimepickerCtrl.prototype.setNgModelValue = function(date) {
      var value = this.dateUtil.createDateAtMidnight(date);
      this.focus(value);
      this.$scope.$emit('md-timepicker-change', value);
      this.ngModelCtrl.$setViewValue(value);
      this.ngModelCtrl.$render();
      return value;
    };

    /**
     * Sets the current view that should be visible in the calendar
     * @param {string} newView View name to be set.
     * @param {number|Date} time Date object or a timestamp for the new display date.
     */
    TimepickerCtrl.prototype.setCurrentView = function(newView, time) {
      var self = this;

      self.$mdUtil.nextTick(function() {
        self.currentView = newView;

        if (time) {
          self.displayTime = angular.isDate(time) ? time : new Date(time);
        }
      });
    };

    /**
     * Focus the cell corresponding to the given date.
     * @param {Date} date The date to be focused.
     */
    TimepickerCtrl.prototype.focus = function(date) {
      if (this.dateUtil.isValidDate(date)) {
        var previousFocus = this.$element[0].querySelector('.md-focus');
        if (previousFocus) {
          previousFocus.classList.remove(this.FOCUSED_MOMENT_CLASS);
        }

        var cellId = this.getDateId(date, this.currentView);
        var cell = document.getElementById(cellId);
        if (cell) {
          cell.classList.add(this.FOCUSED_MOMENT_CLASS);
          cell.focus();
          this.displayTime = date;
        }
      } else {
        var rootElement = this.$element[0].querySelector('[ng-switch]');

        if (rootElement) {
          rootElement.focus();
        }
      }
    };
